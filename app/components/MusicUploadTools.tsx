"use client";

import { useEffect, useRef, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Music2,
  ImagePlus,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Timer,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Type,
  Crosshair,
  RotateCcw,
  Star,
} from "lucide-react";
import {
  COVER_INTERVAL_DEFAULT,
  COVER_INTERVAL_MAX,
  COVER_INTERVAL_MIN,
  COVER_MAX_EDGE,
  MAX_COVERS,
  MAX_COVER_BYTES,
  MAX_LYRIC_LINES,
  MUSIC_GENRES,
  activeLyricIndex,
  parseLyrics,
  toLrc,
  type LyricLine,
  type MusicGenre,
} from "@/app/lib/musicTrack";
import { screenMusicMetadata } from "@/app/lib/musicCopyright";
import { compressCoverImage, compressImageToThumbnail } from "@/app/lib/imageCompress";

// The creator's side of a music upload: cover art, the rotation timer, and
// time-synced lyrics — plus the ownership declaration that the whole
// copyright story actually rests on.
//
// Everything here is authored by the creator. Nothing is guessed. That is a
// deliberate choice for lyrics in particular: automatic alignment needs
// forced-alignment ASR against the vocal track, which is expensive and gets
// it wrong far more often than a person tapping along once.

export interface MusicSettings {
  /** Public https URLs, already uploaded to S3, in display order. */
  covers: string[];
  coverIntervalSeconds: number;
  /** Publishable form: every line has a real number, cascaded (see below). */
  lyrics: LyricLine[];
  /** Powers the Genres browse grid. Closed list — see MUSIC_GENRES. */
  genre: MusicGenre;
  audioSha256: string | null;
  declaredOwnership: boolean;
}

export function emptyMusicSettings(): MusicSettings {
  return {
    covers: [],
    coverIntervalSeconds: COVER_INTERVAL_DEFAULT,
    lyrics: [],
    genre: "Other",
    audioSha256: null,
    declaredOwnership: false,
  };
}

interface CoverEntry {
  url: string;
  /** A 16:9 data URL of this cover, kept so that reordering can hand the
   *  parent a new poster instantly. Re-deriving it from the S3 URL would
   *  mean drawing a cross-origin image to a canvas, which taints it and
   *  makes toDataURL throw. */
  poster: string;
}

export interface MusicUploadToolsProps {
  value: MusicSettings;
  onChange: (next: MusicSettings) => void;
  /** The picked audio, used for the sync preview player. */
  audioFile: File | null;
  /** Cover 1 doubles as the track's thumbnail everywhere on the site. */
  onPosterChange: (dataUrl: string | null) => void;
  /** Live copyright screening reads what the creator has typed so far. */
  title: string;
  description: string;
  tags: string[];
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

// Lines the creator hasn't stamped yet inherit the timestamp of the last
// one they did. Two reasons this is the right fallback rather than 0:
//
//   - Order survives. sanitizeLyrics on the server sorts by time, and
//     Array#sort is stable, so a block of tied lines keeps the order they
//     were written in. Leaving them at 0 would float the whole untimed
//     tail of the song to the top of the lyric sheet.
//   - It reads correctly. An unsynced block appears the moment the last
//     synced line does and stays up — which is exactly what a listener
//     should see when the creator stopped tapping halfway.
export function cascadeTimes(
  texts: string[],
  stampedTimes: (number | undefined)[]
): LyricLine[] {
  let last = 0;
  return texts.map((text, i) => {
    const t = stampedTimes[i];
    if (typeof t === "number" && Number.isFinite(t)) last = t;
    return { time: last, text };
  });
}

export default function MusicUploadTools({
  value,
  onChange,
  audioFile,
  onPosterChange,
  title,
  description,
  tags,
}: MusicUploadToolsProps) {
  // ── Cover art ────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<CoverEntry[]>([]);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // ── Lyrics ───────────────────────────────────────────────────────────
  // `texts` is the words in the creator's order; `stamps` is a parallel
  // array where a number means "timed" and undefined means "not yet". The
  // publishable LyricLine[] handed to the parent is always the cascade of
  // the two, so the parent never has to know about the undefined state.
  const [texts, setTexts] = useState<string[]>([]);
  const [stamps, setStamps] = useState<(number | undefined)[]>([]);
  const [pasteMode, setPasteMode] = useState(true);
  const [pasteText, setPasteText] = useState("");
  const [stampCursor, setStampCursor] = useState(0);

  // ── Preview player, for tapping the lyrics in ────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Object URL rather than state, so nothing here sets state from an
  // effect. The element is the only consumer and it is revoked the moment
  // the file changes or the form unmounts.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioFile) return;

    const url = URL.createObjectURL(audioFile);
    el.src = url;

    return () => {
      el.pause();
      el.removeAttribute("src");
      el.load();
      URL.revokeObjectURL(url);
    };
  }, [audioFile]);

  const emit = (patch: Partial<MusicSettings>) => onChange({ ...value, ...patch });

  const commitLyrics = (nextTexts: string[], nextStamps: (number | undefined)[]) => {
    setTexts(nextTexts);
    setStamps(nextStamps);
    emit({ lyrics: cascadeTimes(nextTexts, nextStamps) });
  };

  // ── Covers ───────────────────────────────────────────────────────────

  const pushCovers = (next: CoverEntry[]) => {
    setEntries(next);
    emit({ covers: next.map((e) => e.url) });
    onPosterChange(next[0]?.poster ?? null);
  };

  const handleCoverFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setCoverError(null);

    const room = MAX_COVERS - entries.length;
    if (room <= 0) {
      setCoverError(`That's the limit — ${MAX_COVERS} covers per track.`);
      return;
    }

    const picked = Array.from(files).slice(0, room);
    if (files.length > room) {
      setCoverError(
        `Only ${room} more ${room === 1 ? "cover" : "covers"} will fit, so the first ${room} ${
          room === 1 ? "was" : "were"
        } used.`
      );
    }

    setCoverBusy(true);
    const added: CoverEntry[] = [];

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) {
        setCoverError("Your session expired. Please sign in again.");
        return;
      }

      for (const file of picked) {
        if (!file.type.startsWith("image/")) {
          setCoverError(`"${file.name}" isn't an image.`);
          continue;
        }
        if (file.size > MAX_COVER_BYTES) {
          setCoverError(
            `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${
              MAX_COVER_BYTES / 1024 / 1024
            }MB per image.`
          );
          continue;
        }

        // Re-encoded here, not on the server: a 5MB original would be
        // refused by the hosting platform's ~4.5MB request ceiling long
        // before it reached us.
        const blob = await compressCoverImage(file, COVER_MAX_EDGE);
        const form = new FormData();
        form.append("file", new File([blob], "cover.jpg", { type: "image/jpeg" }));

        const res = await fetch("/api/music/cover", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
          body: form,
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setCoverError(data.error || "Couldn't upload that cover. Please try again.");
          continue;
        }

        const poster = await compressImageToThumbnail(
          new File([blob], "cover.jpg", { type: "image/jpeg" })
        );
        added.push({ url: data.url as string, poster });
      }

      if (added.length > 0) pushCovers([...entries, ...added]);
    } catch (err) {
      console.error("Cover upload failed:", err);
      setCoverError(err instanceof Error ? err.message : "Couldn't add that cover.");
    } finally {
      setCoverBusy(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const removeCover = (index: number) => {
    setCoverError(null);
    pushCovers(entries.filter((_, i) => i !== index));
  };

  const moveCover = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    pushCovers(next);
  };

  // ── Lyrics ───────────────────────────────────────────────────────────

  const loadPastedLyrics = () => {
    const parsed = parseLyrics(pasteText);
    if (parsed.length === 0) {
      setPasteMode(true);
      return;
    }

    // An LRC paste arrives already timed; plain text arrives all-zero. If
    // anything carries a real timestamp, trust the file and mark every
    // line as stamped — otherwise start the creator at line 1.
    const alreadyTimed = parsed.some((l) => l.time > 0);
    commitLyrics(
      parsed.map((l) => l.text),
      parsed.map((l) => (alreadyTimed ? l.time : undefined))
    );
    setStampCursor(alreadyTimed ? parsed.length : 0);
    setPasteMode(false);
  };

  const backToText = () => {
    setPasteText(
      stamps.some((s) => typeof s === "number")
        ? toLrc(cascadeTimes(texts, stamps))
        : texts.join("\n")
    );
    setPasteMode(true);
  };

  const stampLine = (index: number, at = currentTime) => {
    const next = [...stamps];
    next[index] = Math.max(0, Math.round(at * 100) / 100);
    commitLyrics(texts, next);
    if (index >= stampCursor) setStampCursor(index + 1);
  };

  const nudgeLine = (index: number, delta: number) => {
    const current = stamps[index];
    if (typeof current !== "number") return;
    const next = [...stamps];
    next[index] = Math.max(0, Math.round((current + delta) * 100) / 100);
    commitLyrics(texts, next);
  };

  const clearTimings = () => {
    commitLyrics(
      texts,
      texts.map(() => undefined)
    );
    setStampCursor(0);
  };

  const seekTo = (seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, seconds);
    setCurrentTime(el.currentTime);
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const publishable = cascadeTimes(texts, stamps);
  const liveIndex = playing || currentTime > 0 ? activeLyricIndex(publishable, currentTime) : -1;
  const stampedCount = stamps.filter((s) => typeof s === "number").length;

  // ── Copyright ────────────────────────────────────────────────────────
  const screening = screenMusicMetadata({
    title,
    description,
    tags,
    declaredOwnership: value.declaredOwnership,
  });
  // The ownership box has its own dedicated UI right above, so repeating it
  // in the warning list would just read as nagging.
  const wordingSignals = screening.signals.filter((s) => s.code !== "ownership_not_declared");

  const card =
    "rounded-2xl border border-white/10 bg-[#071120] p-4 light:border-black/10 light:bg-white";
  const label =
    "mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300 light:text-slate-700";

  return (
    <div className="space-y-3">
      {/* ── Ownership ───────────────────────────────────────────────── */}
      <div
        className={`rounded-2xl border p-4 transition ${
          value.declaredOwnership
            ? "border-emerald-500/30 bg-emerald-500/[0.06]"
            : "border-amber-500/30 bg-amber-500/[0.06]"
        }`}
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={value.declaredOwnership}
            onChange={(e) => emit({ declaredOwnership: e.target.checked })}
            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-emerald-500"
          />
          <span>
            <span className="flex items-center gap-1.5 text-xs font-black text-white light:text-slate-900">
              <ShieldCheck size={14} className={value.declaredOwnership ? "text-emerald-400" : "text-amber-400"} />
              This recording is mine to publish
            </span>
            <span className="mt-1 block text-[11px] leading-relaxed text-slate-400 light:text-slate-600">
              I wrote, performed or licensed this track, and I hold the rights to put it on
              InPlayer. Uploading someone else&apos;s recording — including a song from a film, a
              label release, or a cover of a composition I don&apos;t have a licence for — gets the
              track removed and can cost you your channel.
            </span>
          </span>
        </label>
      </div>

      {/* ── Genre ───────────────────────────────────────────────────── */}
      <div className={card}>
        <p className={label}>
          <span className="inline-flex items-center gap-1.5">
            <Music2 size={13} className="text-violet-400" /> Genre
          </span>
        </p>
        <select
          value={value.genre}
          onChange={(e) => emit({ genre: e.target.value as MusicGenre })}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-violet-400/60 light:border-black/10 light:bg-white light:text-slate-900"
        >
          {MUSIC_GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400 light:text-slate-600">
          Lets listeners find this track by browsing a genre. Pick the closest fit — &quot;Other&quot;
          if none really apply.
        </p>
      </div>

      {/* ── Cover art ───────────────────────────────────────────────── */}
      <div className={card}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className={`${label} mb-0`}>
            <span className="inline-flex items-center gap-1.5">
              <Music2 size={13} className="text-violet-400" /> Cover art
            </span>
          </p>
          <span className="text-[11px] font-semibold text-slate-500">
            {entries.length}/{MAX_COVERS} · up to {MAX_COVER_BYTES / 1024 / 1024}MB each
          </span>
        </div>

        <p className="mb-3 text-[11px] leading-relaxed text-slate-400 light:text-slate-600">
          A track has no video frames, so these are the only images it will ever have. The first
          one is the thumbnail people see on cards, in search and in playlists. Add more and the
          player will drift between them while the song plays. Each is squared off from the middle
          — album art is shown square everywhere on InPlayer.
        </p>

        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {entries.map((entry, i) => (
            <div
              key={entry.url}
              className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/30 light:border-black/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- freshly uploaded S3 URL; next/image's loader isn't configured for this bucket and this preview is short-lived. */}
              <img src={entry.url} alt={`Cover ${i + 1}`} className="h-full w-full object-cover" />

              {i === 0 && (
                <span className="absolute left-1 top-1 flex items-center gap-1 rounded-full bg-violet-500/90 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                  <Star size={8} className="fill-current" /> Poster
                </span>
              )}

              <button
                type="button"
                onClick={() => removeCover(i)}
                aria-label={`Remove cover ${i + 1}`}
                // Always visible on touch. `opacity-0 group-hover` alone
                // means a phone can never reveal it — there is no hover —
                // so a creator on mobile could add covers and then never
                // remove or reorder one.
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white transition sm:h-5 sm:w-5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
              >
                <X size={11} />
              </button>

              {entries.length > 1 && (
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/80 to-transparent p-1 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => moveCover(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move cover ${i + 1} earlier`}
                    className="rounded-full p-1.5 text-white disabled:opacity-25 sm:p-0.5"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCover(i, 1)}
                    disabled={i === entries.length - 1}
                    aria-label={`Move cover ${i + 1} later`}
                    className="rounded-full p-1.5 text-white disabled:opacity-25 sm:p-0.5"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {entries.length < MAX_COVERS && (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={coverBusy}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/20 bg-white/[0.02] text-slate-400 transition hover:border-orange-400/50 hover:text-orange-300 disabled:opacity-50 light:border-black/15 light:bg-black/[0.02] light:text-slate-500"
            >
              {coverBusy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
              <span className="text-[10px] font-bold">{coverBusy ? "Uploading" : "Add"}</span>
            </button>
          )}
        </div>

        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => void handleCoverFiles(e.target.files)}
          className="hidden"
        />

        {coverError && (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300 light:text-amber-700">
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
            {coverError}
          </p>
        )}

        {/* ── Rotation timer ────────────────────────────────────────── */}
        {entries.length > 1 && (
          <div className="mt-4 border-t border-white/10 pt-3 light:border-black/10">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-300 light:text-slate-700">
                <Timer size={13} className="text-violet-400" /> Hold each cover for
              </span>
              <span className="rounded-lg bg-violet-500/15 px-2 py-0.5 text-xs font-black text-violet-300 light:bg-violet-500/20 light:text-violet-800">
                {value.coverIntervalSeconds}s
              </span>
            </div>
            <input
              type="range"
              min={COVER_INTERVAL_MIN}
              max={COVER_INTERVAL_MAX}
              step={1}
              value={value.coverIntervalSeconds}
              onChange={(e) => emit({ coverIntervalSeconds: Number(e.target.value) })}
              className="w-full accent-violet-500"
            />
            <p className="mt-1.5 text-[11px] text-slate-500 light:text-slate-600">
              Each change is a slow two-second dissolve, so give them room —{" "}
              {value.coverIntervalSeconds}s means a listener sees about{" "}
              {Math.max(1, Math.floor(180 / value.coverIntervalSeconds))} changes in a three-minute
              song.
            </p>
          </div>
        )}
      </div>

      {/* ── Lyrics ──────────────────────────────────────────────────── */}
      <div className={card}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className={`${label} mb-0`}>
            <span className="inline-flex items-center gap-1.5">
              <Type size={13} className="text-violet-400" /> Lyrics
              <span className="font-normal normal-case tracking-normal text-slate-500">
                (optional)
              </span>
            </span>
          </p>
          {!pasteMode && texts.length > 0 && (
            <span className="text-[11px] font-semibold text-slate-500">
              {stampedCount}/{texts.length} lines timed
            </span>
          )}
        </div>

        {pasteMode ? (
          <>
            <textarea
              rows={5}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Paste your lyrics, one line per line.\n\nAlready have an .lrc file? Paste that instead and the timings come with it."}
              className="w-full resize-y rounded-xl border border-white/10 bg-[#060D18] p-3 text-xs text-white caret-orange-400 outline-none focus:border-orange-400/50 light:border-black/10 light:bg-white light:text-slate-900"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-500 light:text-slate-600">
                Up to {MAX_LYRIC_LINES} lines. You&apos;ll time them on the next step.
              </p>
              <button
                type="button"
                onClick={loadPastedLyrics}
                disabled={!pasteText.trim()}
                className="flex-shrink-0 rounded-xl bg-violet-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-600 disabled:opacity-40"
              >
                {texts.length > 0 ? "Update lines" : "Add lyrics"}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Preview player */}
            <div className="rounded-xl border border-white/10 bg-[#060D18] p-3 light:border-black/10 light:bg-slate-50">
              {audioFile ? (
                <>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={togglePlay}
                      aria-label={playing ? "Pause preview" : "Play preview"}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#FF7A18] to-[#FF9A00] text-white shadow"
                    >
                      {playing ? <Pause size={15} className="fill-current" /> : <Play size={15} className="ml-0.5 fill-current" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={duration || 0}
                      step={0.05}
                      value={Math.min(currentTime, duration || 0)}
                      onChange={(e) => seekTo(Number(e.target.value))}
                      className="min-w-0 flex-1 accent-orange-500"
                      aria-label="Seek preview"
                    />
                    <span className="flex-shrink-0 font-mono text-[11px] tabular-nums text-slate-400 light:text-slate-600">
                      {formatClock(currentTime)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => stampCursor < texts.length && stampLine(stampCursor)}
                    disabled={stampCursor >= texts.length}
                    className="mt-3 w-full rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {stampCursor >= texts.length ? (
                      "Every line is timed"
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Crosshair size={13} />
                        <span className="truncate">
                          Play, then tap here as line {stampCursor + 1} starts
                        </span>
                      </span>
                    )}
                  </button>
                </>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Pick your audio file first and a preview player appears here for timing the
                  lines.
                </p>
              )}
            </div>

            {/* The lines */}
            <div className="mt-2.5 max-h-72 space-y-1 overflow-y-auto pr-1">
              {texts.map((text, i) => {
                const stamp = stamps[i];
                const timed = typeof stamp === "number";
                const isLive = i === liveIndex;
                const isNext = i === stampCursor;

                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                      isLive
                        ? "bg-violet-500/15 ring-1 ring-violet-400/40"
                        : isNext
                          ? "bg-white/[0.06] light:bg-black/[0.04]"
                          : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => timed && seekTo(stamp)}
                      disabled={!timed}
                      title={timed ? "Jump here" : "Not timed yet"}
                      className={`flex h-7 w-[62px] flex-shrink-0 items-center rounded-md px-1 text-left font-mono text-[10px] tabular-nums transition ${
                        timed
                          ? "text-violet-300 hover:bg-violet-500/20 light:text-violet-800"
                          : "text-slate-600 light:text-slate-400"
                      }`}
                    >
                      {timed ? formatClock(stamp) : "--:--.--"}
                    </button>

                    <span
                      className={`min-w-0 flex-1 truncate text-xs ${
                        isLive
                          ? "font-bold text-white light:text-slate-900"
                          : "text-slate-300 light:text-slate-700"
                      }`}
                    >
                      {text}
                    </span>

                    {timed && (
                      <span className="flex flex-shrink-0 items-center">
                        <button
                          type="button"
                          onClick={() => nudgeLine(i, -0.25)}
                          aria-label={`Move line ${i + 1} earlier`}
                          title="Quarter of a second earlier"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold leading-none text-slate-500 hover:bg-white/10 hover:text-white light:hover:bg-black/5 light:hover:text-slate-900"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => nudgeLine(i, 0.25)}
                          aria-label={`Move line ${i + 1} later`}
                          title="Quarter of a second later"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold leading-none text-slate-500 hover:bg-white/10 hover:text-white light:hover:bg-black/5 light:hover:text-slate-900"
                        >
                          +
                        </button>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => stampLine(i)}
                      disabled={!audioFile}
                      title="Set this line to the current playback time"
                      className="h-7 flex-shrink-0 rounded-md bg-white/5 px-2.5 text-[10px] font-bold text-slate-300 transition hover:bg-violet-500 hover:text-white disabled:opacity-30 light:bg-black/5 light:text-slate-700"
                    >
                      Set
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-2.5 light:border-black/10">
              <button
                type="button"
                onClick={backToText}
                className="rounded-lg bg-white/5 px-3 py-1.5 text-[11px] font-bold text-slate-300 transition hover:bg-white/10 light:bg-black/5 light:text-slate-700"
              >
                Edit the words
              </button>
              <button
                type="button"
                onClick={clearTimings}
                disabled={stampedCount === 0}
                className="flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-[11px] font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-40 light:bg-black/5 light:text-slate-700"
              >
                <RotateCcw size={11} /> Start timing again
              </button>
              <p className="ml-auto text-[11px] text-slate-500 light:text-slate-600">
                Untimed lines appear with the last one you timed.
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Copyright screening ─────────────────────────────────────── */}
      {wordingSignals.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
          <p className="flex items-center gap-1.5 text-xs font-black text-amber-200 light:text-amber-800">
            <AlertTriangle size={13} /> This will go to a human reviewer before it earns
          </p>
          <ul className="mt-2 space-y-1">
            {wordingSignals.map((s) => (
              <li key={s.code} className="text-[11px] leading-relaxed text-amber-100/80 light:text-amber-900">
                • {s.detail}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400 light:text-slate-600">
            You can still publish. If the song really is yours, reword the title or description and
            this clears immediately — the wording above is what re-uploads of commercial releases
            almost always carry.
          </p>
        </div>
      )}

      {/* The preview element. Hidden, but a real <audio> — everything above
          reads its playhead. */}
      <audio
        ref={audioRef}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
      />
    </div>
  );
}
