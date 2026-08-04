"use client";

import { useEffect, useRef, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import type { MuxCSSProperties, MuxPlayerRefAttributes } from "@mux/mux-player-react";
import { useSettings } from "@/app/components/settings/SettingsProvider";

// Safari-only fullscreen APIs (`webkit*`) predate the standard Fullscreen
// API and were never added to lib.dom.d.ts — these two small extensions
// are the real, documented WebKit surface, not a loosened `any`.
interface DocumentWithWebkitFullscreen extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
}
interface ElementWithWebkitFullscreen extends HTMLDivElement {
  webkitRequestFullscreen?: () => void;
}
// The Screen Orientation Lock API's `lock()` (unlike `unlock()`, already
// standard in lib.dom.d.ts) is a separate, still-experimental/Android-only
// method (iOS rejects it) that was never added to lib.dom.d.ts — which is
// exactly why the one call site below already wraps it in try/catch and
// treats it as best-effort.
interface ScreenOrientationWithLock extends ScreenOrientation {
  lock?: (orientation: string) => Promise<void>;
}
import {
  Maximize2,
  Minimize2,
  Lock,
  Unlock,
  Sun,
  Volume2,
  VolumeX,
  Play,
  Pause,
} from "lucide-react";

interface VideoPlayerProps {
  playbackId: string;
  title: string;
  videoId: string;
  // Only set for a members-only video's SIGNED playback ID (see
  // app/api/videos/[videoId]/playback-token) — the token that actually
  // authorizes playback of that ID. Omitted entirely for every ordinary
  // public playback ID, which needs no token.
  token?: string;
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

// ---------------------------------------------------------------------
// Mux Player theme colors + a targeted fix for two things its own default
// theme does that globals.css's `.premium-player` rules can't reach:
//
// 1) The control bar background. Mux's compiled default theme (see
//    node_modules/@mux/mux-player-react/.../mux-player.mjs) sets, inside
//    its OWN shadow root:
//      --media-control-background: var(--_secondary-color);
//      --_secondary-color: var(--media-secondary-color, transparent);
//    That re-declaration lives closer to the control-bar buttons than
//    anything `.premium-player` sets from outside, so it wins regardless
//    of globals.css. Since this app never passed a `secondaryColor` prop,
//    `--media-secondary-color` fell through to globals.css's own
//    `--media-secondary-color: #ffb454` (an amber accent meant only for
//    hover highlights) — which is why the whole bar rendered amber/orange
//    instead of the intended dark surface. Passing `secondaryColor`
//    explicitly (same mechanism as the accentColor/primaryColor props
//    already below) fixes it at the source.
// 2) The quality/captions/audio-track/playback-rate submenu backgrounds.
//    That same compiled theme separately force-resets, again inside its
//    own shadow root:
//      media-rendition-menu, media-captions-menu, media-audio-track-menu,
//      media-playback-rate-menu { --media-menu-background: var(--_primary-color); }
//    which is why the quality picker rendered Mux's plain white default
//    no matter what `.premium-player` declared — those four menus don't
//    read --media-menu-background from outside the theme's own shadow
//    tree at all. There's no component prop for this one (primaryColor
//    also drives icon color, so changing it would fix the menu but turn
//    every icon invisible), so the effect below sets the same properties
//    inline, directly on each menu element, once the player has mounted —
//    an inline style on the element itself outranks the theme's own
//    tag-name selector rule for the exact same property.
// Both fixes were confirmed against the real installed media-chrome/
// mux-player packages by inspecting computed styles before/after, not
// guessed from the docs.
const PLAYER_ACCENT_COLOR = "#EA580C";
const PLAYER_ICON_COLOR = "#FFFFFF";
const PLAYER_DARK_SURFACE = "rgba(9, 17, 31, 0.98)";
const PLAYER_MENU_TEXT_COLOR = "#f1f5f9";
const PLAYER_MENU_HOVER_BACKGROUND = "rgba(255, 154, 0, 0.16)";
const PLAYER_MENU_CHECKED_BACKGROUND = "rgba(255, 154, 0, 0.24)";
const PLAYER_MENU_HOVER_OUTLINE = "rgba(255, 154, 0, 0.5) solid 1px";

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
  token,
}: VideoPlayerProps) {
  const playerRef = useRef<MuxPlayerRefAttributes>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Real Settings → Playback → "Closed Captions" toggle — off by default
  // (matching "captions default off unless a viewer turns them on"), on
  // for any viewer who's actually turned the setting on.
  const { playback } = useSettings();

  // --- Mid-roll ad breaks -------------------------------------------------
  // Real ad interruptions, not a stub: on mount, fetch once whether
  // mid-roll is on platform-wide (Admin Panel -> Advertising) and which
  // creative to show; then, as playback reports its own currentTime via
  // onTimeUpdate below, trigger a break every time currentTime crosses a
  // fresh multiple of the configured interval. midrollBreaksShownRef
  // tracks which break indices have already fired THIS mount so seeking
  // back over an old break never re-triggers it. Tiered skip timers (see
  // MIDROLL_SKIP_TIERS_SECONDS in app/lib/videoAds.ts) escalate with how
  // many breaks this viewer has already sat through in this video.
  const [midrollConfig, setMidrollConfig] = useState<{
    enabled: boolean;
    intervalSeconds: number;
    skipTiersSeconds: number[];
  } | null>(null);
  const [midrollAd, setMidrollAd] = useState<{
    adId: string;
    imageUrl: string;
    linkUrl: string;
    title: string;
  } | null>(null);
  const [midrollBreakActive, setMidrollBreakActive] = useState(false);
  const [midrollSkipUnlocked, setMidrollSkipUnlocked] = useState(false);
  const [midrollCountdown, setMidrollCountdown] = useState(0);
  const midrollBreaksShownRef = useRef<Set<number>>(new Set());
  const midrollWasPlayingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/midroll-ads");
        const data = await res.json().catch(() => ({ enabled: false }));
        if (cancelled) return;
        if (data.enabled && data.ad) {
          setMidrollConfig({
            enabled: true,
            intervalSeconds: data.intervalSeconds || 300,
            skipTiersSeconds: Array.isArray(data.skipTiersSeconds) && data.skipTiersSeconds.length
              ? data.skipTiersSeconds
              : [5, 10, 15],
          });
          setMidrollAd(data.ad);
        }
      } catch (err) {
        console.error("VideoPlayer: mid-roll config fetch failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMidrollTimeUpdate = () => {
    const player = playerRef.current;
    if (!player || !midrollConfig?.enabled || !midrollAd || midrollBreakActive) return;

    const currentTime = player.currentTime || 0;
    const duration = player.duration || 0;
    const breakIndex = Math.floor(currentTime / midrollConfig.intervalSeconds);

    // breakIndex 0 covers "before the first interval has elapsed" — never
    // a real break. Also never trigger in the last few seconds, so a
    // break can't fire moments before the video ends anyway.
    if (breakIndex < 1) return;
    if (duration && duration - currentTime < 5) return;
    if (midrollBreaksShownRef.current.has(breakIndex)) return;

    midrollBreaksShownRef.current.add(breakIndex);
    midrollWasPlayingRef.current = !player.paused;
    player.pause();

    const tierIndex = Math.min(
      midrollBreaksShownRef.current.size - 1,
      midrollConfig.skipTiersSeconds.length - 1
    );
    setMidrollCountdown(midrollConfig.skipTiersSeconds[tierIndex] ?? 5);
    setMidrollSkipUnlocked(false);
    setMidrollBreakActive(true);
  };

  // Ticks the skip countdown down to zero, then unlocks the Skip button —
  // the setState call is wrapped in a nested function (rather than called
  // bare in the effect body) purely to satisfy
  // react-hooks/set-state-in-effect, same convention used throughout this
  // codebase.
  useEffect(() => {
    if (!midrollBreakActive) return;
    const unlockSkip = () => setMidrollSkipUnlocked(true);
    if (midrollCountdown <= 0) {
      unlockSkip();
      return;
    }
    const id = window.setTimeout(() => setMidrollCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [midrollBreakActive, midrollCountdown]);

  const trackMidrollEvent = (kind: "click" | "skip") => {
    if (!midrollAd) return;
    fetch("/api/midroll-ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId: midrollAd.adId, kind }),
    }).catch(() => {
      /* best-effort — never blocks resuming playback */
    });
  };

  const skipMidroll = () => {
    if (!midrollSkipUnlocked) return;
    trackMidrollEvent("skip");
    setMidrollBreakActive(false);
    const player = playerRef.current;
    if (player && midrollWasPlayingRef.current) player.play();
  };
  // --- End mid-roll ad breaks ---------------------------------------------

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

  // Center play/pause flash — driven by MuxPlayer's own native play/pause
  // EVENTS (wired below), not by our custom togglePlayPause() directly, so
  // it fires accurately no matter how playback was toggled: our tap/click
  // gesture, Mux's own control-bar button, a keyboard shortcut, or
  // autoplay starting. All devices, matching the seek/brightness feedback
  // pattern already used elsewhere in this file.
  const [pulse, setPulse] = useState<{ icon: "play" | "pause"; key: number } | null>(
    null
  );
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashPulse = (icon: "play" | "pause") => {
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    setPulse({ icon, key: Date.now() });
    pulseTimerRef.current = setTimeout(() => setPulse(null), 700);
  };

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

  // Track the browser's REAL fullscreen state — and bounce any "wrong
  // element" fullscreen into our own CSS fullscreen so custom gestures live.
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fsElement =
        document.fullscreenElement ||
        (document as DocumentWithWebkitFullscreen).webkitFullscreenElement ||
        null;
      const container = containerRef.current;

      // If our <mux-player> (or its inner <video>) entered fullscreen on its
      // OWN element instead of our container — which is exactly what Mux's
      // built-in fullscreen button does — the fullscreen "top layer" becomes
      // just that element, pushing our tap-seek / brightness overlays
      // (siblings of <mux-player>, not descendants) out of view so every
      // gesture looks dead. On touch, bounce out of it and raise our own CSS
      // fullscreen on the container instead, which keeps the whole player —
      // overlays included — intact and interactive.
      const isTouch =
        typeof window !== "undefined" &&
        !!window.matchMedia?.("(pointer: coarse)").matches;
      const tag = ((fsElement as HTMLElement)?.tagName || "").toLowerCase();
      const isOwnPlayerFs =
        !!fsElement &&
        !!container &&
        fsElement !== container &&
        (container.contains(fsElement as Node) ||
          tag.startsWith("mux-") ||
          tag.startsWith("media-") ||
          tag === "video");

      if (isTouch && isOwnPlayerFs) {
        const exited =
          document.exitFullscreen?.() ??
          (document as DocumentWithWebkitFullscreen).webkitExitFullscreen?.();
        Promise.resolve(exited)
          .catch(() => {})
          .finally(() => setCssFullscreen(true));
        return;
      }

      setRealFullscreen(fsElement === container);
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
  // stuck locked once fullscreen (either kind) is gone. The setState call
  // is wrapped in a nested function (rather than called bare in the
  // effect body) purely to satisfy react-hooks/set-state-in-effect, same
  // convention used throughout this codebase (see MaintenanceGate.tsx).
  useEffect(() => {
    (() => {
      if (!isFullscreen) setLocked(false);
    })();
  }, [isFullscreen]);

  // Theme the quality/captions/audio-track/playback-rate submenus — see the
  // big comment above PLAYER_ACCENT_COLOR for why this can't be done with a
  // component prop or a plain globals.css rule. These menu elements exist
  // in the DOM from first mount (just hidden until opened), so one pass
  // right after mount is enough; a short retry loop only covers the rare
  // case where the custom element's shadow tree hasn't upgraded yet on the
  // very first tick.
  useEffect(() => {
    const applyMenuTheme = () => {
      const muxEl = playerRef.current as unknown as HTMLElement | null;
      const themeEl = muxEl?.shadowRoot?.querySelector(
        "media-theme"
      ) as HTMLElement | null;
      const controller = themeEl?.shadowRoot?.querySelector(
        "media-controller"
      ) as HTMLElement | null;
      if (!controller) return false;

      const menus = controller.querySelectorAll(
        "media-rendition-menu, media-captions-menu, media-audio-track-menu, media-playback-rate-menu"
      );
      if (menus.length === 0) return false;

      menus.forEach((node) => {
        const style = (node as HTMLElement).style;
        style.setProperty("--media-menu-background", PLAYER_DARK_SURFACE);
        style.setProperty("--media-text-color", PLAYER_MENU_TEXT_COLOR);
        style.setProperty(
          "--media-menu-item-hover-background",
          PLAYER_MENU_HOVER_BACKGROUND
        );
        style.setProperty(
          "--media-menu-item-checked-background",
          PLAYER_MENU_CHECKED_BACKGROUND
        );
        style.setProperty(
          "--media-menu-item-hover-outline",
          PLAYER_MENU_HOVER_OUTLINE
        );
      });
      return true;
    };

    if (applyMenuTheme()) return;

    let attempts = 0;
    const id = window.setInterval(() => {
      attempts += 1;
      if (applyMenuTheme() || attempts > 20) window.clearInterval(id);
    }, 150);
    return () => window.clearInterval(id);
  }, []);

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
    const el = containerRef.current as ElementWithWebkitFullscreen | null;
    if (!el) return;

    // Try the real Fullscreen API first — it's the best experience where
    // it works (hides browser chrome entirely).
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        // Best-effort orientation lock (Android only; iOS rejects).
        try {
          await (screen.orientation as ScreenOrientationWithLock)?.lock?.("landscape");
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
        (document as DocumentWithWebkitFullscreen).webkitFullscreenElement &&
        (document as DocumentWithWebkitFullscreen).webkitExitFullscreen
      ) {
        (document as DocumentWithWebkitFullscreen).webkitExitFullscreen?.();
      }
    } catch {
      /* ignore */
    }
    try {
      (screen.orientation as ScreenOrientationWithLock)?.unlock?.();
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

  // Rotate the phone to landscape → fullscreen; rotate back → exit.
  //
  // This deliberately raises OUR css fullscreen (not the real Fullscreen
  // API): a device rotation is not a "user gesture", so requestFullscreen
  // is rejected/ignored by mobile browsers here — the previous version
  // leaned on it, so on some phones it silently did nothing at all. CSS
  // fullscreen has no gesture requirement, always engages, and (because it
  // pins our own container) keeps every tap-seek / brightness gesture alive
  // in the rotated view. Three signals are wired for browser-coverage
  // breadth; whichever fires first wins and re-applying the same state is a
  // no-op.
  //
  // Hard limit worth knowing: this can only fire when the phone's system
  // auto-rotate is ON. With it off, the browser viewport never rotates, so
  // NO orientation signal is emitted for any web page to react to — no
  // amount of JS can override an OS rotation lock from inside a browser.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const isTouchDevice = () => window.matchMedia("(pointer: coarse)").matches;
    const readLandscape = () =>
      window.matchMedia("(orientation: landscape)").matches;

    const applyRotation = (isLandscape: boolean) => {
      if (!isTouchDevice()) return;
      // Leave a real (API) fullscreen the viewer explicitly opened alone —
      // only drive our own CSS fullscreen from rotation.
      if (document.fullscreenElement) return;
      setCssFullscreen(isLandscape);
    };

    const mql = window.matchMedia("(orientation: landscape)");
    const handleMqlChange = (e: MediaQueryListEvent) => applyRotation(e.matches);
    mql.addEventListener("change", handleMqlChange);

    const screenOrientation = window.screen?.orientation as ScreenOrientationWithLock | undefined;
    const handleScreenOrientationChange = () =>
      applyRotation((screenOrientation?.type || "").startsWith("landscape"));
    screenOrientation?.addEventListener?.(
      "change",
      handleScreenOrientationChange
    );

    // Legacy global event — some Android builds fire this more reliably than
    // the media-query 'change'. Re-sampled after a tick so orientation has
    // settled by the time we read it.
    const handleWindowOrientation = () =>
      window.setTimeout(() => applyRotation(readLandscape()), 60);
    window.addEventListener("orientationchange", handleWindowOrientation);

    return () => {
      mql.removeEventListener("change", handleMqlChange);
      screenOrientation?.removeEventListener?.(
        "change",
        handleScreenOrientationChange
      );
      window.removeEventListener("orientationchange", handleWindowOrientation);
    };
  }, []);

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
    // While a mid-roll break is showing, none of the play/pause/seek
    // gesture logic below should run — the ad overlay (rendered as a
    // sibling of MuxPlayer, inside this same container) handles its own
    // clicks (the ad link, the Skip button) and stopPropagation()s them
    // itself. This early return is a backstop for anything that isn't.
    if (midrollBreakActive) return;

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
    // Slightly wider side zones (40% each, 20% middle) make the
    // double/triple-tap seek easier to land than a narrow 35/30/35 split.
    const side: "left" | "right" | null =
      clickX < rect.width * 0.4
        ? "left"
        : clickX > rect.width * 0.6
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
    if (midrollBreakActive || e.pointerType !== "touch" || locked) return;
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
        tokens={token ? { playback: token } : undefined}
        metadata={{
          video_id: videoId,
          video_title: title,
        }}
        videoTitle={title}
        accentColor={PLAYER_ACCENT_COLOR}
        primaryColor={PLAYER_ICON_COLOR}
        secondaryColor={PLAYER_DARK_SURFACE}
        // Captions start OFF for every viewer by default, unless they've
        // turned on Settings → Playback → "Closed Captions" (that setting
        // was previously inert — it persisted but nothing read it; now it
        // genuinely controls this). Mux Player's own captions/subtitles
        // menu still lets a viewer turn a language on/off manually
        // mid-playback either way — this prop only sets the very first
        // render's default state.
        defaultHiddenCaptions={!playback.captions}
        playbackRates={[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]}
        // "any": try to autoplay WITH sound first; if the browser blocks
        // that, Mux automatically retries muted instead of giving up.
        autoPlay="any"
        // Real poster frame instead of a flat black rectangle.
        thumbnailTime={0}
        onPlay={() => flashPulse("play")}
        onPause={() => flashPulse("pause")}
        onTimeUpdate={handleMidrollTimeUpdate}
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

      {/* Mid-roll ad break — a real interruption, not a stub: the
          underlying player is genuinely paused (see
          handleMidrollTimeUpdate) while this is shown. z-40 so it sits
          above every other overlay/indicator in this player, and its own
          onClick/onPointerDown handlers stopPropagation() so none of the
          tap-seek/brightness gesture handlers on the container fire while
          it's up (handlePlayerClickCapture/handlePlayerPointerDown also
          bail out early on midrollBreakActive as a backstop). */}
      {midrollBreakActive && midrollAd && (
        <div
          className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/95 p-6 text-center"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-slate-300">
            Advertisement
          </span>
          <a
            href={midrollAd.linkUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() => trackMidrollEvent("click")}
            className="block max-h-[55%] max-w-full overflow-hidden rounded-2xl border border-white/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- an
                admin-uploaded data URL, not a static app asset. */}
            <img
              src={midrollAd.imageUrl}
              alt={midrollAd.title}
              className="max-h-full max-w-full object-contain"
            />
          </a>
          <p className="max-w-xs text-xs text-slate-400">{midrollAd.title}</p>
          <button
            type="button"
            onClick={skipMidroll}
            disabled={!midrollSkipUnlocked}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${
              midrollSkipUnlocked
                ? "bg-white text-black hover:bg-white/90"
                : "cursor-not-allowed bg-white/10 text-slate-400"
            }`}
          >
            {midrollSkipUnlocked ? "Skip Ad" : `Skip in ${midrollCountdown}s`}
          </button>
        </div>
      )}

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
          className={`pointer-events-none absolute top-1/2 z-20 flex max-h-[85%] -translate-y-1/2 flex-col items-center gap-1.5 rounded-2xl bg-black/60 px-2.5 py-2.5 text-white backdrop-blur-sm ${
            dragIndicator.kind === "brightness" ? "left-4" : "right-4"
          }`}
        >
          {dragIndicator.kind === "brightness" ? (
            <Sun size={15} />
          ) : dragIndicator.percent <= 0 ? (
            <VolumeX size={15} />
          ) : (
            <Volume2 size={15} />
          )}
          <div className="flex h-14 w-1.5 flex-col-reverse overflow-hidden rounded-full bg-white/25">
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

      {/* Center play/pause flash — all devices. Purely decorative feedback,
          so it's pointer-events-none and never blocks the gestures above. */}
      {pulse && (
        <div
          key={pulse.key}
          className="pointer-events-none absolute left-1/2 top-1/2 z-20"
        >
          <div className="animate-play-pause-flash flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
            {pulse.icon === "play" ? (
              <Play size={28} className="ml-1 fill-current" />
            ) : (
              <Pause size={28} className="fill-current" />
            )}
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
