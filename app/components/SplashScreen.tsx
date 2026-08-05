"use client";

import { useEffect, useState } from "react";

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
// Always renders on a near-black stage regardless of the site's own
// light/dark theme, the same way streaming-app splash idents always cut to
// black first — a bright cream backdrop would wash out the zoom/flash
// entirely and undercut the "punchy" effect being asked for here, so this
// is a deliberate, one-off exception to the app's normal theme-follows-site
// rule.
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

    // Lock scroll while the curtain is up so the already-rendered page
    // underneath can't be scrolled/interacted with mid-animation. Restored
    // in every exit path (fade-out timer, and the cleanup function) so a
    // fast route change or unmount never leaves scrolling permanently
    // disabled.
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const restoreScroll = () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };

    const leaveTimer = window.setTimeout(() => setLeaving(true), holdMs);
    const removeTimer = window.setTimeout(() => {
      restoreScroll();
      setVisible(false);
    }, holdMs + fadeOutMs);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
      restoreScroll();
    };
    // Intentionally runs once on mount only — visible/leaving are only
    // ever set BY this effect, never read as a re-run trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[999999] flex items-center justify-center overflow-hidden bg-[#020203] transition-opacity duration-[450ms] ease-out ${
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
          {/* Always the dark/white-wordmark asset — the stage is always
              near-black now regardless of site theme, so there's no light
              variant to swap to here anymore. */}
          <img
            src="/logos/inplayer-mark-dark.png"
            alt="INPLAYER"
            draggable={false}
            className="animate-splash-cinematic-zoom h-16 w-auto object-contain drop-shadow-[0_4px_32px_rgba(249,115,22,0.55)] sm:h-20 md:h-24"
          />

          {/* Diagonal light-shine sweeping once across the logo right after
              the flash — a common premium logo-reveal touch (think app-icon
              or brand-ident shines), and a "crazy"/dynamic beat that isn't
              just another static glow. */}
          <div className="animate-splash-logo-shine pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
        </div>

        <p className="animate-splash-tagline-in mt-5 text-[11px] font-bold uppercase tracking-[0.3em] text-orange-300 sm:text-sm">
          {TAGLINE}
        </p>
      </div>
    </div>
  );
}
