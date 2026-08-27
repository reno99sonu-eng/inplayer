// Everything that makes a music upload more than "a video with no picture":
// its cover art rotation and its time-synced lyrics.
//
// THIS FILE IS PURE — no DOM, no React, no AWS — so the upload editor, the
// player and the API all agree on the same rules, and every one of them can
// be tested by simply calling it.
//
// Both features are creator-authored. Nothing here guesses: the creator
// picks the covers, sets how long each is held, and stamps each lyric line
// with the second it should light up. That is deliberate — automatic
// lyric alignment needs forced-alignment ASR against the vocal, which is a
// different (and much more expensive) piece of machinery, and it is wrong
// far more often than a creator with a stopwatch.

// ── Cover art ─────────────────────────────────────────────────────────

/** How many cover images one track may carry. */
export const MAX_COVERS = 5;

/** The largest file a creator may pick, before browser-side compression.
 *  Compression is not optional: Vercel refuses a request body over ~4.5MB,
 *  so a 5MB original could never reach the server intact. The picker
 *  accepts up to this, then re-encodes to something a few hundred KB in
 *  size — which is more than enough for artwork that is never displayed
 *  larger than about 1000px square. */
export const MAX_COVER_BYTES = 5 * 1024 * 1024;

/** Longest edge, in px, of a stored cover. Comfortably sharper than the
 *  largest size the player ever renders it at, including on a 3x screen. */
export const COVER_MAX_EDGE = 1600;

/** Seconds each cover is held before crossfading to the next. The creator
 *  chooses; these bound what they can choose to something that still looks
 *  like a slow, deliberate transition rather than a slideshow or a strobe. */
export const COVER_INTERVAL_MIN = 3;
export const COVER_INTERVAL_MAX = 60;
export const COVER_INTERVAL_DEFAULT = 12;

export function normalizeCoverInterval(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return COVER_INTERVAL_DEFAULT;
  return Math.min(COVER_INTERVAL_MAX, Math.max(COVER_INTERVAL_MIN, Math.round(n)));
}

/**
 * Which cover should be on screen at `seconds` into the track.
 *
 * Wraps around, so a 3-minute song with two covers and a 12s interval keeps
 * alternating for the whole song rather than freezing on the last one.
 * Returns 0 for any nonsense input so a caller can always index safely.
 */
export function coverIndexAt(
  seconds: number,
  coverCount: number,
  intervalSeconds: number
): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  if (!Number.isFinite(coverCount) || coverCount <= 1) return 0;

  const interval = normalizeCoverInterval(intervalSeconds);
  const count = Math.min(Math.floor(coverCount), MAX_COVERS);
  return Math.floor(seconds / interval) % count;
}

// ── Genre ─────────────────────────────────────────────────────────────

/** The fixed set of genres a creator can tag a track with. Deliberately a
 *  closed list rather than free text — "Pop" typed three different ways
 *  across three uploads would make genre browsing useless. "Other" is the
 *  honest catch-all for anything that doesn't fit one of the rest. */
export const MUSIC_GENRES = [
  "Pop",
  "Hip-Hop",
  "R&B",
  "Rock",
  "Electronic",
  "Classical",
  "Folk",
  "Indie",
  "Devotional",
  "Bollywood",
  "Instrumental",
  "Other",
] as const;

export type MusicGenre = (typeof MUSIC_GENRES)[number];

/** Server-side sanitising of the creator-picked genre. Anything outside the
 *  fixed list (a stale client, a hand-made request) falls back to "Other"
 *  rather than being rejected outright or stored as uncontrolled free text —
 *  the same "never trust the client" posture as sanitizeLyrics/sanitizeCovers
 *  below. */
export function sanitizeGenre(raw: unknown): MusicGenre {
  if (typeof raw === "string" && (MUSIC_GENRES as readonly string[]).includes(raw)) {
    return raw as MusicGenre;
  }
  return "Other";
}

// ── Lyrics ────────────────────────────────────────────────────────────

/** One line, and the second of the track at which it becomes the active
 *  line. `time` is the START of the line — the line stays active until the
 *  next line's time, or the end of the song. */
export interface LyricLine {
  time: number;
  text: string;
}

export const MAX_LYRIC_LINES = 300;
export const MAX_LYRIC_LINE_LENGTH = 200;

/**
 * Accepts what a creator actually pastes, in either of the two forms they
 * are likely to have:
 *
 *   LRC, the standard karaoke format their existing tools export:
 *       [01:23.45] Line of the song
 *
 *   or plain text, one line per line, with no timings at all — which the
 *   editor then lets them stamp by tapping along to playback.
 *
 * Mixed input is fine: untimed lines in an otherwise-timed paste keep a
 * time of 0 until the creator stamps them, rather than being thrown away.
 * Blank lines are dropped; a blank line in lyrics carries no information
 * the highlight can use, and it would otherwise become a line that lights
 * up with nothing in it.
 */
export function parseLyrics(raw: string): LyricLine[] {
  if (typeof raw !== "string" || !raw.trim()) return [];

  const lines: LyricLine[] = [];

  for (const rawLine of raw.split(/\r?\n/)) {
    if (lines.length >= MAX_LYRIC_LINES) break;

    // [mm:ss.xx] or [mm:ss] — the fractional part may be 2 or 3 digits.
    const match = rawLine.match(/^\s*\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]\s*(.*)$/);

    if (match) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fractionRaw = match[3] ?? "";
      // "5" means .5s, "05" means .05s, "005" means .005s — pad rather than
      // assuming hundredths, or [00:01.5] would come out as 1.05s.
      const fraction = fractionRaw ? Number(fractionRaw) / 10 ** fractionRaw.length : 0;
      const text = match[4].trim();
      if (!text) continue;
      lines.push({
        time: Math.max(0, minutes * 60 + seconds + fraction),
        text: text.slice(0, MAX_LYRIC_LINE_LENGTH),
      });
      continue;
    }

    const text = rawLine.trim();
    if (!text) continue;
    lines.push({ time: 0, text: text.slice(0, MAX_LYRIC_LINE_LENGTH) });
  }

  return sortLyrics(lines);
}

/** Ordered by time, because the player's active-line lookup assumes it and
 *  a creator stamping lines out of order is entirely normal. A stable sort
 *  keeps same-time lines (including a block of unstamped 0s) in the order
 *  they were written. */
export function sortLyrics(lines: LyricLine[]): LyricLine[] {
  return [...lines].sort((a, b) => a.time - b.time);
}

/** Serialised back to LRC, so a creator can export what they stamped and
 *  re-import it later or use it elsewhere. */
export function toLrc(lines: LyricLine[]): string {
  return sortLyrics(lines)
    .map(({ time, text }) => {
      const total = Math.max(0, time);
      const mm = String(Math.floor(total / 60)).padStart(2, "0");
      const ss = String(Math.floor(total % 60)).padStart(2, "0");
      const cs = String(Math.round((total % 1) * 100)).padStart(2, "0");
      return `[${mm}:${ss}.${cs}] ${text}`;
    })
    .join("\n");
}

/**
 * Index of the line that should be highlighted at `seconds`, or -1 before
 * the first line starts.
 *
 * A plain backwards scan: the active line is the last one whose time has
 * already passed. Backwards rather than forwards because playback moves
 * forward, so the answer is usually near the end of what has elapsed — and
 * because it handles a seek backwards correctly without any state.
 *
 * TIES MATTER, and they are common. The upload editor gives every line the
 * creator hasn't stamped yet the timestamp of the last one they did, so a
 * half-synced song ends with a block of lines all sharing one time; a
 * completely unsynced set of lyrics is a block all sharing 0. Among lines
 * with the same time the FIRST is the active one — the block begins there,
 * and the ones after it are still visible below. Picking the last of the
 * tie instead (which a bare backwards scan does) would jump the highlight
 * to the final line of the song the moment playback started.
 */
export function activeLyricIndex(lines: LyricLine[], seconds: number): number {
  if (!Array.isArray(lines) || lines.length === 0) return -1;
  if (!Number.isFinite(seconds) || seconds < 0) return -1;

  for (let i = lines.length - 1; i >= 0; i--) {
    if (seconds >= lines[i].time) {
      let first = i;
      while (first > 0 && lines[first - 1].time === lines[i].time) first--;
      return first;
    }
  }
  return -1;
}

/**
 * How far through the active line playback is, 0→1.
 *
 * This is what lets the highlight *sweep* across a line as it is sung
 * rather than snapping on and off — the thing that separates lyrics that
 * feel alive from lyrics that feel like subtitles.
 *
 * The final line has no following line to measure against, so it uses the
 * track duration when one is known and otherwise falls back to a sensible
 * few seconds. Either way it never returns >1 or <0.
 */
export function lyricLineProgress(
  lines: LyricLine[],
  index: number,
  seconds: number,
  durationSeconds?: number
): number {
  if (!Array.isArray(lines) || index < 0 || index >= lines.length) return 0;

  const start = lines[index].time;
  // Skip over any lines sharing this timestamp — see activeLyricIndex.
  // Without this, a tied block would measure its sweep against a "next"
  // line at the same second, giving a zero-length window and a highlight
  // that snaps instantly to full instead of travelling.
  let nextIdx = index + 1;
  while (nextIdx < lines.length && lines[nextIdx].time === start) nextIdx++;
  const next = lines[nextIdx]?.time;
  const fallbackEnd =
    typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > start
      ? durationSeconds
      : start + 4;
  const end = typeof next === "number" ? next : fallbackEnd;

  if (!(end > start)) return 0;
  return Math.min(1, Math.max(0, (seconds - start) / (end - start)));
}

/** Server-side sanitising of whatever the client sent. Everything is
 *  re-derived rather than trusted: a hand-made request could otherwise
 *  store 10,000 lines or a megabyte on a single line. */
export function sanitizeLyrics(raw: unknown): LyricLine[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: LyricLine[] = [];

  for (const entry of raw) {
    if (cleaned.length >= MAX_LYRIC_LINES) break;
    if (!entry || typeof entry !== "object") continue;

    const time = Number((entry as { time?: unknown }).time);
    const text = (entry as { text?: unknown }).text;
    if (typeof text !== "string") continue;

    const trimmed = text.trim();
    if (!trimmed) continue;

    cleaned.push({
      time: Number.isFinite(time) && time > 0 ? Math.round(time * 100) / 100 : 0,
      text: trimmed.slice(0, MAX_LYRIC_LINE_LENGTH),
    });
  }

  return sortLyrics(cleaned);
}

/** Server-side sanitising of the cover list — public https URLs only, so a
 *  hand-made request can't point the player at javascript: or at a data:
 *  blob big enough to blow the DynamoDB item limit. */
export function sanitizeCovers(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((url): url is string => typeof url === "string" && /^https:\/\//i.test(url.trim()))
    .map((url) => url.trim())
    .slice(0, MAX_COVERS);
}
