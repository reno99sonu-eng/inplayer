"use client";

import { useEffect, useRef, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import type { MuxCSSProperties } from "@mux/mux-player-react";
import { Maximize2, Minimize2, Lock, Unlock } from "lucide-react";

interface VideoPlayerProps {
  playbackId: string;
  title: string;
  videoId: string;
}

export default function VideoPlayer({
  playbackId,
  title,
  videoId,
}: VideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [locked, setLocked] = useState(false);

  // The browser's real fullscreen state is the single source of truth for
  // isFullscreen — it stays correct no matter which control was used to
  // enter (our own Expand button below, Mux's own built-in fullscreen
  // button in its control bar, the browser's native controls, or the OS
  // back-gesture / Esc to leave). The previous implementation faked
  // "fullscreen" purely from a `(orientation: landscape)` CSS media query,
  // completely independent of what the browser actually considered
  // fullscreen — that mismatch is what made the video size/position itself
  // inconsistently after rotating, especially when Mux's own fullscreen
  // control (rather than ours) was the one tapped.
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fsElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        null;
      const isNowFullscreen = fsElement === containerRef.current;
      setIsFullscreen(isNowFullscreen);
      if (!isNowFullscreen) {
        // Lock mode only makes sense while fullscreen (it exists to stop
        // accidental taps while holding the phone in landscape) — never
        // leave the player stuck locked once fullscreen is gone, since
        // there'd otherwise be no way to reach the Unlock button again.
        setLocked(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener(
      "webkitfullscreenchange",
      handleFullscreenChange
    );
    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  const enterFullscreen = async () => {
    const el = containerRef.current as any;
    if (!el) return;

    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        // Older WebKit / iOS Safari.
        el.webkitRequestFullscreen();
      }
    } catch {
      // Fullscreen can be silently denied (no user-gesture context, or the
      // browser just doesn't support it here) — never let that break
      // playback, which keeps working fine without it.
      return;
    }

    // Best-effort only: the Screen Orientation Lock API isn't part of
    // TypeScript's DOM lib (hence the `as any`), isn't supported at all on
    // iOS Safari, and can reject even on Android if the browser decides
    // the context doesn't qualify. None of that should ever block or
    // break entering fullscreen.
    try {
      await (screen.orientation as any)?.lock?.("landscape");
    } catch {
      // Landscape just won't be forced — the viewer can still rotate
      // their phone manually, which is what most people do anyway.
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    } catch {
      // ignore
    }
    try {
      (screen.orientation as any)?.unlock?.();
    } catch {
      // ignore
    }
  };

  const toggleFullscreen = () => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  // Best-effort auto-fullscreen when the phone is physically rotated to
  // landscape while this player is on screen and playing. This can
  // silently fail — browsers generally require a direct user gesture
  // (a tap/click) to grant fullscreen, and an orientation change doesn't
  // reliably count as one — so it's a nice-to-have layered on top of the
  // Expand button, never something else depends on it. Auto-EXIT back to
  // normal layout on rotate-back-to-portrait is reliable by contrast
  // (programmatically exiting fullscreen has no user-gesture requirement),
  // and is what actually fixes "the video doesn't fit after rotating"
  // even on browsers where the auto-entry above doesn't fire.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mql = window.matchMedia("(orientation: landscape)");

    const handleOrientationChange = (e: MediaQueryListEvent) => {
      const container = containerRef.current;
      if (!container) return;

      if (e.matches) {
        // Only auto-enter if this player is actually the one playing —
        // otherwise every VideoPlayer on a page (e.g. a grid of previews)
        // would fight to grab fullscreen on every rotation.
        const player = playerRef.current;
        const isPlaying = player && !player.paused;
        if (isPlaying && !document.fullscreenElement) {
          enterFullscreen();
        }
      } else if (document.fullscreenElement === container) {
        exitFullscreen();
      }
    };

    mql.addEventListener("change", handleOrientationChange);
    return () => mql.removeEventListener("change", handleOrientationChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mux Player has its own BUILT-IN click-to-toggle-play/pause gesture on
  // the video surface (confirmed in Mux/media-chrome's own docs — this is
  // why clicking did nothing on desktop: our handler ran on the normal
  // bubble phase, AFTER Mux's own internal listener had already toggled
  // the state, so our toggle just flipped it right back). Fix: run in the
  // CAPTURE phase instead (fires on the way down, before Mux's own
  // listener), and stopPropagation() there so Mux's built-in gesture never
  // fires at all — but only for clicks on the video itself, never inside
  // the bottom control-bar zone, so the real play/pause button, volume,
  // scrubber, settings and fullscreen controls keep working normally.
  const handlePlayerClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (locked) {
      // Lock mode swallows every tap on the player surface — only the
      // Unlock button (outside this capture zone, see below) stays
      // reachable, matching the standard mobile video-player lock pattern.
      e.stopPropagation();
      return;
    }

    const player = playerRef.current;
    if (!player) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const controlBarZone = 64;

    if (clickY > rect.height - controlBarZone) return;

    e.stopPropagation();

    if (player.paused) {
      player.play();
    } else {
      player.pause();
    }
  };

  return (
    <div
      ref={containerRef}
      className="premium-player relative overflow-hidden rounded-2xl bg-black"
      onClickCapture={handlePlayerClickCapture}
    >
      <MuxPlayer
        ref={playerRef}
        playbackId={playbackId}
        metadata={{
          video_id: videoId,
          video_title: title,
        }}
        videoTitle={title}
        accentColor="#EA580C"
        primaryColor="#FFFFFF"
        defaultHiddenCaptions={false}
        playbackRates={[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]}
        // "any": try to autoplay WITH sound first; if the browser blocks
        // that (very common on mobile, especially iOS Safari, far more
        // aggressive about this than desktop), Mux automatically retries
        // muted instead of just giving up. Plain `autoPlay={true}` doesn't
        // fall back at all — on mobile that meant the video just sat there
        // un-played until a manual tap, which combined with no poster
        // frame (fixed below) is exactly what read as "a lot of empty
        // black space" on the watch page.
        autoPlay="any"
        // Gives Mux a real poster frame (auto-generated from the video
        // itself) to show before playback starts and whenever it's
        // paused/ended, instead of a flat black rectangle.
        thumbnailTime={0}
        style={
          {
            width: "100%",
            aspectRatio: "16 / 9",
            "--controls-backdrop-color": "rgba(0, 0, 0, 0.7)",
            // Hides Mux's own control bar entirely while locked, so a
            // locked viewer can't reach play/pause, scrubber, volume, etc.
            // through it either — the tap-swallowing overlay below is a
            // second layer of defense on top of this.
            ...(locked ? { "--controls": "none" } : {}),
          } as MuxCSSProperties
        }
      />

      {/* Mobile-only Expand/Collapse button. Desktop viewers already have
          Mux's own built-in fullscreen control in the bar, but on mobile
          that control is small and easy to miss — this was exactly the
          "no button to expand the video" gap reported. Hidden while
          locked, since lock mode intentionally blocks every control
          except Unlock. */}
      {!locked && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          aria-label={isFullscreen ? "Exit fullscreen" : "Expand video"}
          className="
            lg:hidden absolute left-3 top-3 z-30
            flex h-9 w-9 items-center justify-center rounded-full
            border border-white/15 bg-black/50 text-white backdrop-blur-md
            transition-transform active:scale-90
          "
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      )}

      {/* Lock mode toggle — only shown while actually fullscreen, matching
          the standard mobile video-player pattern (YouTube etc.) where
          "lock" exists to stop accidental taps while holding the phone in
          landscape. Placed at the opposite corner from Expand so the two
          never collide, and safely reuses the same top-right spot the
          page's desktop-oriented theater-mode button sits at elsewhere —
          that button lives outside this fullscreened element, so the
          browser doesn't paint it at all while we're truly fullscreen. */}
      {isFullscreen && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLocked((v) => !v);
          }}
          aria-label={locked ? "Unlock controls" : "Lock controls"}
          className="
            absolute right-3 top-3 z-30
            flex h-9 w-9 items-center justify-center rounded-full
            border border-white/15 bg-black/50 text-white backdrop-blur-md
            transition-transform active:scale-90
          "
        >
          {locked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>
      )}

      {/* Full-cover transparent tap-swallowing overlay while locked. Sits
          above Mux's control bar (already hidden via --controls: none
          above — this is a second layer of defense in case any control
          ignores that custom property) and below the Unlock button itself
          (z-20 < z-30), so the only thing a locked viewer can tap is
          Unlock. */}
      {locked && (
        <div
          className="absolute inset-0 z-20"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
