"use client";

import { useEffect, useState } from "react";
import { useScrollLock } from "../hooks/useScrollLock";

// Reworked per Reno's feedback, twice now:
// 1) The original version (glowing particles, spinning ring, multi-color
//    drift) read as "decorative," not premium — replaced with a
//    Netflix/Disney+-style cinematic ident: one bold, controlled moment
//    instead of ongoing ambient motion.
// 2) That cinematic version still had a soft blurred circle glowing behind
//    the logo — Reno flagged the circle specifically and asked for a more
//    "crazy style premium" logo transition, a bit faster. This version:
//    removes the circle entirely (no glow blob anywhere), gives the logo a
//    punchier 3D-tilt zoom with more overshoot (see splashCinematicZoom in
//    globals.css), and adds a diagonal light-shine sweep across the logo
//    right after the flash — a common premium-logo-reveal touch — instead
//    of a static glow. Everything is faster too: the whole reveal is ~15%
//    quicker and the on-screen hold is shorter.
// Per Reno's follow-up feedback, this now follows the site's own light/dark
// theme instead of always cutting to black — same `light:` variant pattern
// used everywhere else in the app (NavbarLogo.tsx, page.tsx, MaintenanceGate,
// AnnouncementBanner), and the exact same two logo assets NavbarLogo.tsx
// already swaps between: inplayer-mark-dark.png (white wordmark) for the
// dark stage, inplayer-mark-light.png (recolored for a light backdrop) for
// the light one. The theme class is applied to <html> by a blocking script
// in app/layout.tsx before first paint (see ThemeProvider.tsx's matching
// comment), so these `light:` classes already resolve correctly on this
// component's very first render — no client-only theme detection needed,
// and no flash of the wrong stage color.
//
// The real site is already mounted behind this overlay the whole time
// (SiteChrome renders {children} in parallel, not after this unmounts) —
// this is purely a visual curtain, so it never delays hydration, data
// fetching, or first paint of the actual page.
//
// Shows once per FRESH page load. SiteChrome (and this component inside
// it) is mounted once at the root of the app and stays mounted across
// client-side navigations, so this naturally does not re-trigger every
// time someone clicks around the site — only on an actual full
// load/refresh.
const TAGLINE = "The Future of Entertainment";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  // Lock scroll while the curtain is up so the already-rendered page
  // underneath can't be scrolled/interacted with mid-animation. Shared
  // reference-counted lock (see useScrollLock) — plain save/restore of
  // document.body.style.overflow used to break when this and
  // AnnouncementBanner's own takeover were both up at once (whichever
  // released first would "restore" scroll back to the other one's
  // "hidden" instead of the true original value, leaving the page stuck
  // unscrollable). This releases automatically the instant `visible`
  // flips false below, or on unmount either way.
  useScrollLock(visible);

  useEffect(() => {
    if (!visible) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Tight and punchy on purpose — a cinematic ident earns its keep by
    // being short and bold, not by lingering. The 1.05s zoom/flash/shine
    // sequence (see globals.css) plays out, holds fully revealed for a
    // beat, then cuts out fast — no slow ambient fade. holdMs is scaled up
    // from the previous 1300ms by the same ~1.235x as the CSS animation
    // durations in globals.css, per Reno's "a little slower, not too slow"
    // feedback — so the hold still starts right after the tagline
    // animation actually finishes instead of cutting it off early.
    const holdMs = reducedMotion ? 350 : 1600;
    const fadeOutMs = reducedMotion ? 180 : 380;

    const leaveTimer = window.setTimeout(() => setLeaving(true), holdMs);
    const removeTimer = window.setTimeout(() => {
      setVisible(false);
    }, holdMs + fadeOutMs);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
    // Intentionally runs once on mount only — visible/leaving are only
    // ever set BY this effect, never read as a re-run trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[999999] flex items-center justify-center overflow-hidden bg-[#020203] light:bg-[#F4ECDA] transition-opacity duration-[450ms] ease-out ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* The flash burst — a brief, bright wash timed to hit exactly when
          the logo's zoom peaks, like a camera flash / lens flare at the
          moment of impact. This is the single "punchy" beat the whole
          ident is built around. No circular glow blob anymore — Reno
          flagged that as the thing to remove; this radial wash fills the
          whole screen rectangle rather than reading as a distinct circle. */}
      <div className="animate-splash-flash-burst pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.92)_0%,rgba(255,166,0,0.6)_35%,rgba(255,166,0,0)_70%)]" />

      <div
        className="relative flex flex-col items-center px-6 text-center"
        style={{ perspective: "900px" }}
      >
        {/* The logo mark + its light-shine sweep, both clipped to exactly
            the logo's own footprint (not a separate floating shape) — the
            "premium reveal" touch that replaces the old glow circle. */}
        <div className="relative overflow-hidden rounded-xl">
          {/* White wordmark for the dark stage — hidden in light mode. */}
          <img
            src="/logos/inplayer-mark-dark.png"
            alt="INPLAYER"
            draggable={false}
            className="light:hidden animate-splash-cinematic-zoom h-16 w-auto object-contain drop-shadow-[0_4px_32px_rgba(249,115,22,0.55)] sm:h-20 md:h-24"
          />
          {/* Recolored wordmark for the light stage — same asset
              NavbarLogo.tsx uses so the splash's brand mark always matches
              the navbar the visitor lands on right after it. */}
          <img
            src="/logos/inplayer-mark-light.png"
            alt="INPLAYER"
            draggable={false}
            className="hidden light:block animate-splash-cinematic-zoom h-16 w-auto object-contain drop-shadow-[0_4px_24px_rgba(249,115,22,0.35)] sm:h-20 md:h-24"
          />

          {/* Diagonal light-shine sweeping once across the logo right after
              the flash — a common premium logo-reveal touch (think app-icon
              or brand-ident shines), and a "crazy"/dynamic beat that isn't
              just another static glow. */}
          <div className="animate-splash-logo-shine pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
        </div>

        <p className="animate-splash-tagline-in mt-5 text-[11px] font-bold uppercase tracking-[0.3em] text-orange-300 light:text-orange-600 sm:text-sm">
          {TAGLINE}
        </p>
      </div>
    </div>
  );
}
