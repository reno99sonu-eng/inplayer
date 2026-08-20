"use client";

import { useEffect, useMemo, useRef } from "react";
import { Music2 } from "lucide-react";
import {
  activeLyricIndex,
  coverIndexAt,
  lyricLineProgress,
  normalizeCoverInterval,
  type LyricLine,
} from "@/app/lib/musicTrack";

// What a music track looks like while it plays: the cover art, and the
// lyrics moving with the song.
//
// Rendered UNDER the Mux player inside VideoPlayer (see its `music` prop),
// with pointer-events:none throughout — every control, the tap-seek
// overlays and the settings menu all still belong to Mux and behave exactly
// as they do on a video. Nothing here is interactive; it only reacts.
//
// It is driven by `currentTime` passed down from the player's own
// timeupdate, rather than by a timer of its own. That matters: a timer
// drifts, and worse, it keeps counting when the listener pauses or scrubs.
// Reading the real playhead means the artwork and the lyrics are correct
// after a seek without any resync logic.

export interface MusicStageProps {
  /** Ordered cover URLs. The first is the poster/primary. */
  covers: string[];
  /** Seconds each cover is held before crossfading to the next. */
  coverIntervalSeconds: number;
  lyrics: LyricLine[];
  /** The player's real playhead, in seconds. */
  currentTime: number;
  /** Track length, used to pace the sweep on the final lyric line. */
  durationSeconds?: number;
  title: string;
  /** Shown under the title while the artwork is on screen. */
  artist?: string;
}

// How long a cover takes to dissolve into the next one. Deliberately slow —
// the brief asked for "beautifully and slowly", and anything under about a
// second reads as a slideshow cut rather than a dissolve.
const CROSSFADE_MS = 2000;

export default function MusicStage({
  covers,
  coverIntervalSeconds,
  lyrics,
  currentTime,
  durationSeconds,
  title,
  artist,
}: MusicStageProps) {
  const interval = normalizeCoverInterval(coverIntervalSeconds);
  const safeCovers = useMemo(() => covers.filter(Boolean), [covers]);

  const targetIndex = coverIndexAt(currentTime, safeCovers.length, interval);

  // EVERY cover is mounted at once, stacked, and only opacity moves. There
  // are at most five of them (MAX_COVERS), so the cost is trivial — and it
  // buys two things a two-layer swap does not:
  //
  //   - No flash, ever. An <img> only starts fetching once it is in the
  //     DOM, so a layer whose src changes at the moment it fades in shows a
  //     blank frame the first time through.
  //   - No state and no effect. Which cover is visible is a pure function
  //     of the playhead, because that is exactly what it is. The earlier
  //     version kept two indices plus a "which layer is in front" flag in
  //     state and flipped them from an effect — cascading renders on the
  //     playback hot path, and React's own lint rules reject it.

  const activeIndex = activeLyricIndex(lyrics, currentTime);
  const hasLyrics = lyrics.length > 0;

  // The sweep across the current line, 0→1. Used as a gradient stop so the
  // highlight travels through the words as they are sung instead of the
  // whole line switching colour at once.
  const sweep = lyricLineProgress(lyrics, activeIndex, currentTime, durationSeconds);

  // Keep the active line centred in the lyrics scroll container.
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (activeLineRef.current && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const el = activeLineRef.current;
      const elTop = el.offsetTop;
      const elHeight = el.offsetHeight;
      const containerHeight = container.offsetHeight;
      container.scrollTo({
        top: Math.max(0, elTop - containerHeight / 2 + elHeight / 2),
        behavior: "smooth",
      });
    }
  }, [activeIndex]);

  const primaryCover = safeCovers[0];

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {/* Ambient wash: the current cover blown up and heavily blurred, so a
          square image never leaves dead black bars in a 16:9 frame and the
          whole stage takes on the artwork's colour. */}
      {primaryCover ? (
        <>
          {safeCovers.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- remote S3 URL, no next/image loader needed for a decorative layer.
            <img
              key={`wash-${url}`}
              src={url}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full scale-110 object-cover blur-3xl"
              style={{
                opacity: i === targetIndex ? 0.4 : 0,
                transition: `opacity ${CROSSFADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
              }}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0f05] via-[#090b10] to-[#040609]" />
      )}

      <div className={`absolute inset-0 flex items-center gap-4 p-4 pb-14 sm:gap-6 sm:p-8 sm:pb-20 ${hasLyrics ? "justify-start" : "justify-center"}`}>
        {/* ── The sleeve ── */}
        <div
          className={`relative aspect-square flex-shrink-0 ${
            hasLyrics ? "h-full max-h-[min(100%,180px)] sm:max-h-[min(100%,320px)]" : "h-full max-h-[min(100%,340px)]"
          }`}
        >
          {primaryCover ? (
            safeCovers.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- as above.
              <img
                key={url}
                src={url}
                // Only the cover actually on screen carries the title, so a
                // screen reader announces the artwork once rather than
                // five times over.
                alt={i === targetIndex ? title : ""}
                aria-hidden={i !== targetIndex}
                className="absolute inset-0 h-full w-full rounded-2xl object-cover shadow-[0_25px_70px_rgba(0,0,0,.65)] ring-1 ring-white/15"
                style={{
                  opacity: i === targetIndex ? 1 : 0,
                  transition: `opacity ${CROSSFADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                }}
              />
            ))
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-orange-500/20 via-black to-amber-500/20 shadow-[0_25px_70px_rgba(0,0,0,.65)]">
              <Music2 size={48} className="text-orange-400/80 animate-pulse" />
            </div>
          )}

          {/* Which cover of how many — only worth showing when there is
              more than one, and it doubles as reassurance that the
              rotation is deliberate rather than a glitch. */}
          {safeCovers.length > 1 && (
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {safeCovers.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all duration-700 ${
                    i === targetIndex ? "w-4 bg-white/90" : "w-1 bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── The lyrics ── */}
        {hasLyrics && (
          <div className="relative flex h-full min-w-0 flex-1">
            {/* Feathered top and bottom, so lines enter and leave rather
                than being chopped off at a hard edge. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-black/60 to-transparent sm:h-16" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-black/60 to-transparent sm:h-16" />

            <div
              ref={lyricsContainerRef}
              className="h-full w-full overflow-y-auto py-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:py-12"
            >
              {lyrics.map((line, i) => {
                const isActive = i === activeIndex;
                const distance = Math.abs(i - activeIndex);

                return (
                  <p
                    key={`${i}-${line.time}`}
                    ref={isActive ? activeLineRef : undefined}
                    className={`origin-left py-1 font-black leading-tight tracking-[-0.01em] transition-all duration-500 sm:py-1.5 ${
                      isActive
                        ? "text-xl text-white sm:text-3xl"
                        : distance === 1
                          ? "text-sm text-white/45 sm:text-xl"
                          : "text-xs text-white/20 sm:text-lg"
                    }`}
                    style={
                      isActive
                        ? {
                            // The sweep. A hard-stopped gradient clipped to
                            // the text: everything left of `sweep` is fully
                            // lit, everything right of it is dimmed, and the
                            // boundary travels as the line is sung. The 2%
                            // gap between stops softens the edge just enough
                            // that it reads as a wipe rather than a cursor.
                            backgroundImage: `linear-gradient(90deg, #ffffff ${sweep * 100}%, rgba(255,255,255,0.45) ${sweep * 100 + 2}%)`,
                            WebkitBackgroundClip: "text",
                            backgroundClip: "text",
                            color: "transparent",
                            textShadow: "0 2px 24px rgba(0,0,0,.55)",
                          }
                        : undefined
                    }
                  >
                    {line.text}
                  </p>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Title block — bottom-left, clear of the sleeve, and only while
          there are no lyrics taking that space. */}
      {!hasLyrics && (
        <div className="absolute bottom-16 left-0 right-0 px-5 text-center sm:bottom-20 sm:px-8">
          <p className="truncate text-base font-black text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.7)] sm:text-lg">
            {title}
          </p>
          {artist && (
            <p className="truncate text-xs font-semibold text-white/70 sm:text-sm">{artist}</p>
          )}
        </div>
      )}
    </div>
  );
}
