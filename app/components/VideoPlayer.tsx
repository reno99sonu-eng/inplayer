"use client";

import { useEffect, useRef, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import type { MuxCSSProperties } from "@mux/mux-player-react";
import {
  Maximize2,
  Minimize2,
  Lock,
  Unlock,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";

interface VideoPlayerProps {
  playbackId: string;
  title: string;
  videoId: string;
}

// Multi-tap seek tuning (touch devices): taps on the left/right third of
// the video within this window chain together — 2 taps = 10s, 3 = 20s,
// each further tap +10s, YouTube-style. A lone tap (no follow-up inside
// this same window) commits to a play/pause toggle instead. Both jobs
// deliberately share ONE window rather than the toggle using its own,
// shorter delay (which is what this used to do): with two different
// timers, a second tap landing between the short one and the long one
// arrived AFTER the toggle had already fired but still inside the chain
// window, so it fired a toggle first and then also seeked, from what the
// viewer experienced as a single double-tap.
const TAP_CHAIN_MS = 400;
const SEEK_STEP_SECONDS = 10;

// Netflix/YouTube-style vertical swipe on the video surface: left half
// adjusts brightness, right half adjusts volume, like every mainstream
// mobile video app. Distinguished from the tap-seek gestures above by
// MOVEMENT, not position — a touch that moves more than this many px
// vertically before lifting is a drag; anything under that stays a tap.
// Touch only, matching every other custom gesture on this player —
// desktop already has Mux's own volume slider and OS-level brightness.
const VERTICAL_DRAG_THRESHOLD_PX = 12;
const BRIGHTNESS_MIN = 0.5;
const BRIGHTNESS_MAX = 1.5;

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

  // Brightness/volume vertical-drag state.
  const [brightness, setBrightness] = useState(1);
  const [dragIndicator, setDragIndicator] = useState<{
    kind: "brightness" | "volume";
    percent: number;
  } | null>(null);
  const dragRef = useRef<{
    startY: number;
    side: "left" | "right";
    startBrightness: number;
    startVolume: number;
    dragging: boolean;
  } | null>(null);
  // A drag that just ended still fires a synthetic click on release —
  // this swallows exactly that one click so it never ALSO toggles
  // play/pause or starts a seek chain on top of the brightness/volume
  // change the drag already made.
  const suppressNextClickRef = useRef(false);

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
  //
  // Two independent rotation signals are wired to the same handler —
  // matchMedia AND the dedicated Screen Orientation API — because not
  // every mobile browser fires both equally reliably; whichever fires
  // first wins, and calling enter/exit twice for one physical rotation
  // is harmless (both are idempotent). Previously this also required
  // the video to already be playing, which silently did nothing if you
  // rotated a paused/just-loaded video — dropped so rotation always
  // reacts, matching YouTube/Netflix.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const isTouchDevice = () => window.matchMedia("(pointer: coarse)").matches;

    const applyRotation = (isLandscape: boolean) => {
      // Only react on touch devices — desktop windows "rotate" when
      // resized, which must never hijack the page.
      if (!isTouchDevice()) return;

      if (isLandscape) {
        if (!document.fullscreenElement) enterFullscreen();
      } else {
        exitFullscreen();
      }
    };

    const mql = window.matchMedia("(orientation: landscape)");
    const handleMqlChange = (e: MediaQueryListEvent) => applyRotation(e.matches);
    mql.addEventListener("change", handleMqlChange);

    const screenOrientation = (window.screen as any)?.orientation;
    const handleScreenOrientationChange = () => {
      const type: string = screenOrientation?.type || "";
      applyRotation(type.startsWith("landscape"));
    };
    screenOrientation?.addEventListener?.(
      "change",
      handleScreenOrientationChange
    );

    return () => {
      mql.removeEventListener("change", handleMqlChange);
      screenOrientation?.removeEventListener?.(
        "change",
        handleScreenOrientationChange
      );
    };
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

  // Shared by the click-capture gesture handler below AND the drag-start
  // handler for the brightness/volume swipe: true ONLY when the tap landed
  // on one of Mux Player's actual controls (a button, slider, menu or the
  // control bar) or one of our own overlay buttons — NOT on the bare video
  // surface.
  //
  // This uses composedPath() (not e.target, which shadow-DOM retargeting
  // reports as just <mux-player> no matter what was pressed inside it) to
  // see the real, un-retargeted path. The critical subtlety that broke
  // EVERY custom gesture until now: Media Chrome wraps the <video> in
  // <media-controller> and lays a <media-gesture-receiver> over it — both
  // are `media-*` elements, so the previous blanket "tag starts with
  // media-" test counted a tap on the plain video as a control tap and
  // bailed out. Result: tap-seek and the brightness/volume swipe silently
  // did nothing, even though captions/quality (which are SUPPOSED to be
  // let through) kept working — which is exactly the symptom seen.
  //
  // Fix: walk outward from the tap and decide at the FIRST element that
  // settles it. A genuine control (…-button / …-range / …-menu / …-dialog
  // / media-control-bar, or a native button/input/a/select) → it's a
  // control. Reaching the video / gesture layer / core controller first
  // → it was the bare video surface. Deciding at these stable core names
  // means we also never depend on the (theme-specific) wrapper tag name.
  const isOnRealControl = (
    nativeEvent: { composedPath?: () => EventTarget[] },
    boundary: EventTarget
  ) => {
    const path = nativeEvent.composedPath?.() || [];
    for (const node of path) {
      if (node === boundary) break;
      const tag = (node as HTMLElement).tagName;
      if (!tag) continue;
      const lower = tag.toLowerCase();

      // Bare video surface / its gesture layer / the core controller,
      // reached without passing a control first → NOT a control.
      if (
        lower === "video" ||
        lower === "mux-video" ||
        lower === "media-gesture-receiver" ||
        lower === "media-controller" ||
        lower === "media-container"
      ) {
        return false;
      }

      // A genuine interactive control / flyout menu / slider / dialog, the
      // control bar itself, or one of our own overlay <button>s.
      if (
        lower === "button" ||
        lower === "input" ||
        lower === "a" ||
        lower === "select" ||
        lower === "media-control-bar" ||
        lower.includes("button") ||
        lower.includes("range") ||
        lower.includes("menu") ||
        lower.includes("dialog")
      ) {
        return true;
      }
    }
    return false;
  };

  // Mux Player has its own BUILT-IN click-to-toggle gesture on the video
  // surface — this capture-phase handler intercepts taps first (and
  // stopPropagation()s) so all gesture behavior is ours: instant toggle
  // for mouse; delayed toggle + double/triple-tap seek for touch; total
  // swallow while locked. Clicks in the bottom control-bar zone are never
  // touched, so Mux's real controls keep working.
  const handlePlayerClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    // A brightness/volume drag that just ended still fires a click on
    // release — swallow exactly that one so it doesn't ALSO toggle
    // play/pause or start a seek chain.
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      e.stopPropagation();
      return;
    }

    // See isOnRealControl above — checked before the lock branch below,
    // deliberately, so the Unlock button keeps working even while locked.
    if (isOnRealControl(e.nativeEvent, e.currentTarget)) return;

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

    // Fresh tap (any zone) — always clear any toggle still pending from a
    // PREVIOUS tap sequence first (e.g. a side tap followed by a middle
    // tap before the side tap's own toggle timer had fired). Without
    // this, that stale timer fires on its own moments later and silently
    // flips play/pause a second time.
    seq.side = side;
    seq.count = 1;
    seq.lastTime = now;
    clearToggleTimer();

    if (side === null) {
      // Middle of the screen — plain play/pause, no seek chaining.
      togglePlayPause();
      return;
    }

    // A side tap MIGHT become a double-tap seek — wait exactly as long
    // as the chain window above allows a follow-up tap, so there's no
    // gap where the toggle could fire before a still-valid chained tap
    // arrives (see that constant's comment).
    toggleTimerRef.current = setTimeout(() => {
      toggleTimerRef.current = null;
      togglePlayPause();
    }, TAP_CHAIN_MS);
  };

  // Brightness (left half) / volume (right half) vertical drag — start.
  const handlePlayerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch" || locked) return;
    if (isOnRealControl(e.nativeEvent, e.currentTarget)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y > rect.height - 64) return; // control-bar strip

    const player = playerRef.current;
    dragRef.current = {
      startY: e.clientY,
      side: e.clientX - rect.left < rect.width / 2 ? "left" : "right",
      startBrightness: brightness,
      startVolume: player ? (player.muted ? 0 : player.volume) : 1,
      dragging: false,
    };
  };

  const handlePlayerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerType !== "touch") return;

    const deltaY = drag.startY - e.clientY; // up = positive

    if (!drag.dragging) {
      if (Math.abs(deltaY) < VERTICAL_DRAG_THRESHOLD_PX) return;
      drag.dragging = true;
      suppressNextClickRef.current = true;
      // A real drag started — a pending single-tap toggle from whatever
      // this same touch's tap-zone logic might otherwise resolve to must
      // never fire underneath it, and the tap-chain resets to a clean
      // slate so a tap right after this drag is never misread as a
      // continuation of whatever tap preceded the drag.
      clearToggleTimer();
      tapSeqRef.current = { side: null, count: 0, lastTime: 0 };
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = deltaY / rect.height; // full-height swipe = full range

    if (drag.side === "left") {
      const range = BRIGHTNESS_MAX - BRIGHTNESS_MIN;
      const next = Math.min(
        BRIGHTNESS_MAX,
        Math.max(BRIGHTNESS_MIN, drag.startBrightness + ratio * range)
      );
      setBrightness(next);
      setDragIndicator({
        kind: "brightness",
        percent: (next - BRIGHTNESS_MIN) / range,
      });
    } else {
      const next = Math.min(1, Math.max(0, drag.startVolume + ratio));
      const player = playerRef.current;
      if (player) {
        player.volume = next;
        player.muted = next <= 0;
      }
      setDragIndicator({ kind: "volume", percent: next });
    }
  };

  const handlePlayerPointerEnd = () => {
    dragRef.current = null;
    setDragIndicator(null);
  };

  return (
    <div
      ref={containerRef}
      // touch-none (touch-action: none) is the actual fix for the tap-seek
      // and brightness/volume swipe gestures below: without it, a mobile
      // browser's OWN native gesture recognizer races ours on every touch —
      // a fast double/triple tap gets eaten by native double-tap-to-zoom,
      // and a sustained vertical drag gets hijacked into a native page
      // scroll/bounce (which fires pointercancel and starves our
      // pointermove handler) before our JS ever sees a clean gesture.
      // Single taps on Mux's own menus/buttons are untouched by this —
      // touch-action only suppresses the browser's native gesture handling,
      // never JS event delivery, so click/pointer events still reach both
      // our handlers and Mux's own shadow-DOM controls exactly as before.
      className={`premium-player relative touch-none overflow-hidden rounded-2xl bg-black ${
        cssFullscreen ? "fake-fullscreen" : ""
      }`}
      onClickCapture={handlePlayerClickCapture}
      // Suppresses Chrome's native long-press "Copy video frame /
      // Picture-in-Picture" menu on the <video> inside Mux's shadow DOM —
      // contextmenu bubbles out through the shadow boundary, so a listener
      // here catches it regardless of what was actually long-pressed.
      onContextMenu={(e) => e.preventDefault()}
      onPointerDownCapture={(e) => {
        lastPointerTypeRef.current = e.pointerType || "mouse";
      }}
      onPointerDown={handlePlayerPointerDown}
      onPointerMove={handlePlayerPointerMove}
      onPointerUp={handlePlayerPointerEnd}
      onPointerCancel={handlePlayerPointerEnd}
      onPointerLeave={handlePlayerPointerEnd}
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
            // Netflix/YouTube-style left-half brightness swipe (see
            // handlePlayerPointerMove) — only the video surface dims or
            // brightens, never our own overlay buttons/indicators, since
            // those are siblings of MuxPlayer, not descendants.
            filter:
              brightness !== 1 ? `brightness(${brightness})` : undefined,
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

      {/* Brightness (left) / volume (right) drag feedback (touch) —
          Netflix/YouTube-style vertical swipe. */}
      {dragIndicator && (
        <div
          className={`pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 flex flex-col items-center gap-2 rounded-2xl bg-black/60 px-3 py-4 text-white backdrop-blur-sm ${
            dragIndicator.kind === "brightness" ? "left-6" : "right-6"
          }`}
        >
          {dragIndicator.kind === "brightness" ? (
            <Sun size={16} />
          ) : dragIndicator.percent <= 0 ? (
            <VolumeX size={16} />
          ) : (
            <Volume2 size={16} />
          )}
          <div className="flex h-20 w-1.5 flex-col-reverse overflow-hidden rounded-full bg-white/25">
            <div
              className="w-full rounded-full bg-white"
              style={{
                height: `${Math.round(dragIndicator.percent * 100)}%`,
              }}
            />
          </div>
          <span className="text-[10px] font-bold">
            {Math.round(dragIndicator.percent * 100)}%
          </span>
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
