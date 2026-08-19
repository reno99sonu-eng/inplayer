// "Remember playback position" — the store behind Settings › Playback.
//
// That toggle previously wrote to a provider field nothing ever read, so it
// was one of the settings that looked functional and did nothing. This is
// the real implementation: VideoPlayer.tsx saves a position as you watch and
// resumes from it next time you open the same video.
//
// Deliberately localStorage, not the server. A resume point is per-device by
// nature (you don't want your phone's position yanked because you scrubbed
// on a TV), it's worthless if lost, and writing one every few seconds to
// DynamoDB for every viewer would be a real cost for no benefit.

const STORAGE_KEY = "inplayer-playback-positions";

// Below this, resuming is more annoying than helpful — you've barely
// started, and being dropped 4 seconds in feels like a bug.
const MIN_SAVE_SECONDS = 15;

// Within this much of the end, the video is finished. Resuming someone into
// the last few seconds means they immediately hit the end screen.
const END_THRESHOLD_SECONDS = 20;

// Positions are pruned to this many entries (most recent first) so the
// blob can't grow without bound on a heavy viewer's device.
const MAX_ENTRIES = 200;

interface StoredPosition {
  seconds: number;
  updatedAt: number;
}

type PositionMap = Record<string, StoredPosition>;

function read(): PositionMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as PositionMap) : {};
  } catch {
    return {};
  }
}

function write(map: PositionMap) {
  try {
    const entries = Object.entries(map)
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Quota exceeded or storage disabled — a lost resume point is not worth
    // surfacing an error over.
  }
}

export function savePlaybackPosition(
  videoId: string,
  seconds: number,
  duration: number
): void {
  if (typeof window === "undefined" || !videoId) return;
  if (!Number.isFinite(seconds) || seconds < MIN_SAVE_SECONDS) return;

  // Finished (or as good as) — drop any stored point so the next open starts
  // cleanly from the beginning rather than at the credits.
  if (Number.isFinite(duration) && duration > 0 && seconds >= duration - END_THRESHOLD_SECONDS) {
    clearPlaybackPosition(videoId);
    return;
  }

  const map = read();
  map[videoId] = { seconds, updatedAt: Date.now() };
  write(map);
}

export function getPlaybackPosition(videoId: string): number | null {
  if (typeof window === "undefined" || !videoId) return null;
  const stored = read()[videoId];
  return stored && Number.isFinite(stored.seconds) ? stored.seconds : null;
}

export function clearPlaybackPosition(videoId: string): void {
  if (typeof window === "undefined" || !videoId) return;
  const map = read();
  if (!(videoId in map)) return;
  delete map[videoId];
  write(map);
}

/** Called when the setting is switched off — "off" has to mean previously
 *  saved points stop resuming too, not merely that no new ones are added. */
export function clearAllPlaybackPositions(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — same reasoning as write().
  }
}
