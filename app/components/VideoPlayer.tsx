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

// Multi-tap seek tuning (touch devices): taps on the left/right third of
// the video within this window chain together — 2 taps = 10s, 3 = 20s,
// each further tap +10s, YouTube-style.
const TAP_CHAIN_MS = 400;
// How long a lone touch-tap waits before toggling play/pause — long enough
// to know no second tap (seek) is coming.
const SINGLE_TAP_TOGGLE_MS = 330;
const SEEK_STEP_SECONDS = 10;

export default function VideoPlayer({
  playbackId,
  title,
  videoId,
}: VideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [realFullscreen, setRealFullscreen] = useState(false);
  // CSS "fake" fullscreen — used wherever the real Fullscreen API is
  // unavailable (iPhone Safari has none for custom players) or refuses to
  // engage (browsers reject requestFullscreen without a fresh user
  // gesture, which is exactly the rotate-the-phone case). The container
  // gets position:fixed inset-0 instead — visually identical.
  const [cssFullscreen, setCssFullscreen] = useState(false);
  const [locked, setLocked] = useState(false);

  const isFullscreen = realFullscreen || cssFullscreen;

  // What kind of pointer produced the current click — lets the click
  // handler behave differently for touch (delayed toggle + tap-seek) vs
  // mouse (instant toggle), without brittle user-agent sniffing.
  const lastPointerTypeRef = useRef<string>("mouse");

  // Multi-tap seek state.
  const tapSeqRef = useRef<{
    side: "left" | "right" | null;
    count: number;
    lastTime: number;
  }>({ side: null, count: 0, lastTime: 0 });
  const toggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seekIndicator, setSeekIndicator] = useState<{
    side: "left" | "right";
    total: number;
    key: number;
  } | null>(null);

  // Track the browser's REAL fullscreen state.
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fsElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        null;
      setRealFullscreen(fsElement === containerRef.current);
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

  // Lock mode only makes sense while fullscreen — never leave the player
  // stuck locked once fullscreen (either kind) is gone.
  useEffect(() => {
    if (!isFullscreen) setLocked(false);
  }, [isFullscreen]);

  // While CSS-fullscreen: freeze page scroll behind the player, and let
  // Esc exit (parity with real fullscreen).
  useEffect(() => {
    if (!cssFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCssFullscreen(false);
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [cssFullscreen]);

  const enterFullscreen = async () => {
    const el = containerRef.current as any;
    if (!el) return;

    // Try the real Fullscreen API first — it's the best experience where
    // it works (hides browser chrome entirely).
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        // Best-effort orientation lock (Android only; iOS rejects).
        try {
          await (screen.orientation as any)?.lock?.("landscape");
        } catch {
          /* fine — viewer can rotate manually */
        }
        return;
      }
      if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        return;
      }
    } catch {
      // Rejected (usually: no fresh user gesture, e.g. auto-rotate) —
      // fall through to the CSS fallback below.
    }

    // No API, or it refused — CSS fullscreen works unconditionally.
    setCssFullscreen(true);
  };

  const exitFullscreen = async () => {
    if (cssFullscreen) setCssFullscreen(false);

    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (
        (document as any).webkitFullscreenElement &&
        (document as any).webkitExitFullscreen
      ) {
        (document as any).webkitExitFullscreen();
      }
    } catch {
      /* ignore */
    }
    try {
      (screen.orientation as any)?.unlock?.();
    } catch {
      /* ignore */
    }
  };

  const toggleFullscreen = () => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  // Rotate-to-landscape → fullscreen, rotate-back → exit. The real
  // Fullscreen API usually refuses here (no user gesture), which is
  // exactly why enterFullscreen falls back to CSS fullscreen — so this
  // now genuinely works on phones and tablets.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mql = window.matchMedia("(orientation: landscape)");

    const handleOrientationChange = (e: MediaQueryListEvent) => {
      const container = containerRef.current;
      if (!container) return;

      // Only react on touch devices — desktop windows "rotate" when
      // resized, which must never hijack the page.
      const isTouch = window.matchMedia("(pointer: coarse)").matches;
      if (!isTouch) return;

      if (e.matches) {
        const player = playerRef.current;
        const isPlaying = player && !player.paused;
        if (isPlaying && !document.fullscreenElement) {
          enterFullscreen();
        }
      } else {
        exitFullscreen();
      }
    };

    mql.addEventListener("change", handleOrientationChange);
    return () => mql.removeEventListener("change", handleOrientationChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cssFullscreen]);

  const clearToggleTimer = () => {
    if (toggleTimerRef.current) {
      clearTimeout(toggleTimerRef.current);
      toggleTimerRef.current = null;
    }
  };

  const togglePlayPause = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.paused) {
      player.play();
    } else {
      player.pause();
    }
  };

  const applySeek = (side: "left" | "right", chainCount: number) => {
    const player = playerRef.current;
    if (!player) return;

    const delta = side === "right" ? SEEK_STEP_SECONDS : -SEEK_STEP_SECONDS;
    const duration = Number.isFinite(player.duration) ? player.duration : Infinity;
    player.currentTime = Math.max(
      0,
      Math.min(duration, player.currentTime + delta)
    );

    // Cumulative label: 2 taps → 10s, 3 taps → 20s, ...
    const total = (chainCount - 1) * SEEK_STEP_SECONDS;
    setSeekIndicator({ side, total, key: Date.now() });

    if (indicatorTimerRef.current) clearTimeout(indicatorTimerRef.current);
    indicatorTimerRef.current = setTimeout(() => setSeekIndicator(null), 800);
  };

  // Mux Player has its own BUILT-IN click-to-toggle gesture on the video
  // surface — this capture-phase handler intercepts taps first (and
  // stopPropagation()s) so all gesture behavior is ours: instant toggle
  // for mouse; delayed toggle + double/triple-tap seek for touch; total
  // swallow while locked. Clicks in the bottom control-bar zone are never
  // touched, so Mux's real controls keep working.
  const handlePlayerClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (locked) {
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

    // Mouse / pen: exactly the old behavior — instant play/pause.
    if (lastPointerTypeRef.current !== "touch") {
      togglePlayPause();
      return;
    }

    // Touch: figure out which zone was tapped.
    const clickX = e.clientX - rect.left;
    const side: "left" | "right" | null =
      clickX < rect.width * 0.35
        ? "left"
        : clickX > rect.width * 0.65
          ? "right"
          : null;

    const now = Date.now();
    const seq = tapSeqRef.current;

    if (
      side &&
      seq.side === side &&
      now - seq.lastTime < TAP_CHAIN_MS &&
      seq.count >= 1
    ) {
      // Chained tap on the same side → seek instead of toggling.
      seq.count += 1;
      seq.lastTime = now;
      clearToggleTimer();
      applySeek(side, seq.count);
      return;
    }

    // Fresh tap (any zone).
    seq.side = side;
    seq.count = 1;
    seq.lastTime = now;

    if (side === null) {
      // Middle of the screen — plain play/pause, no seek chaining.
      togglePlayPause();
      return;
    }

    // A side tap MIGHT become a double-tap seek — wait briefly before
    // treating it as play/pause.
    clearToggleTimer();
    toggleTimerRef.current = setTimeout(() => {
      toggleTimerRef.current = null;
      togglePlayPause();
    }, SINGLE_TAP_TOGGLE_MS);
  };

  return (
    <div
      ref={containerRef}
      className={`premium-player relative overflow-hidden rounded-2xl bg-black ${
        cssFullscreen ? "fake-fullscreen" : ""
      }`}
      onClickCapture={handlePlayerClickCapture}
      onPointerDownCapture={(e) => {
        lastPointerTypeRef.current = e.pointerType || "mouse";
      }}
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
        // that, Mux automatically retries muted instead of giving up.
        autoPlay="any"
        // Real poster frame instead of a flat black rectangle.
        thumbnailTime={0}
        style={
          {
            width: "100%",
            aspectRatio: "16 / 9",
            "--controls-backdrop-color": "rgba(0, 0, 0, 0.7)",
            // Hide Mux's control bar entirely while locked.
            ...(locked ? { "--controls": "none" } : {}),
          } as MuxCSSProperties
        }
      />

      {/* Double/triple-tap seek feedback (touch) */}
      {seekIndicator && (
        <div
          key={seekIndicator.key}
          className={`pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 ${
            seekIndicator.side === "right" ? "right-6" : "left-6"
          }`}
        >
          <div className="animate-seek-flash flex flex-col items-center gap-1 rounded-full bg-black/60 px-4 py-3 text-white backdrop-blur-sm">
            <span className="text-lg font-black leading-none">
              {seekIndicator.side === "right" ? "»" : "«"}
            </span>
            <span className="text-xs font-bold">
              {seekIndicator.total} sec
            </span>
          </div>
        </div>
      )}

      {/* Mobile-only Expand/Collapse button (desktop has Mux's own
          fullscreen control in the bar). Hidden while locked. */}
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

      {/* Lock mode toggle — only while fullscreen (real or CSS). */}
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

      {/* Tap-swallowing overlay while locked — only Unlock stays tappable. */}
      {locked && (
        <div
          className="absolute inset-0 z-20"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
