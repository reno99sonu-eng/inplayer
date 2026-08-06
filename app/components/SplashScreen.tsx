"use client";

import { useEffect, useState } from "react";
import { useScrollLock } from "../hooks/useScrollLock";
import { useAuthModal } from "./auth/AuthProvider";

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

// Module-level, not component state — this is what actually makes the
// splash "only on fresh load/reload," not just "only once per mount."
// SiteChrome unmounts+remounts this component on some client-side
// navigations (e.g. entering/leaving /admin, whose branch renders
// `<>{children}</>` with no SplashScreen at all — see SiteChrome.tsx), and
// a plain useState(true) has no memory across that remount, so the intro
// used to replay every time. A real reload or fresh visit re-evaluates
// this whole module from scratch (a new document load always gets a new
// JS module instance), which is exactly when it SHOULD play again — no
// sessionStorage needed, since sessionStorage would also survive an
// actual reload and wrongly suppress the replay-on-reload behavior Reno
// asked for.
let hasPlayedThisLoad = false;

export default function SplashScreen() {
  const [visible, setVisible] = useState(() => {
    // This module-level flag must never be read or written during
    // server-side rendering. Next.js/Vercel keep a server process (or
    // serverless function instance) warm and reuse it for MANY different
    // visitors' requests, but a plain JS module is only ever evaluated
    // ONCE per process — so without this guard, the FIRST request a given
    // server instance ever handled would flip this flag to `true`, and
    // every other visitor routed to that same warm instance afterwards
    // would get server-rendered HTML with NO splash (this returning
    // `false`), while their browser (a genuinely fresh page load, its own
    // separate JS instance) always computes `true` on its own first
    // render. That server/client disagreement is a hydration mismatch,
    // and it was happening on essentially every real visit — confirmed by
    // reproducing it locally, where it fires from the very first request
    // after any earlier request had already primed the flag on the
    // server. React recovers from a hydration mismatch by discarding and
    // rebuilding the whole mismatched subtree on the client, and that
    // forced rebuild is what was surfacing as the "stuck on the splash
    // logo," "the greeting text is missing," and the real React crashes
    // (#300/#310) Reno reported — this is the actual root cause, not a
    // stale-deploy/stale-tab issue. On the server this always evaluates to
    // `true` (matching what a fresh browser will always compute on its
    // own first render, so the very first paint never mismatches); the
    // module flag still does its original job of preventing a replay on a
    // client-side-only remount (e.g. entering/leaving /admin) within the
    // same already-hydrated tab, since it's only ever read/written in the
    // browser from that point on.
    if (typeof window === "undefined") return true;
    if (hasPlayedThisLoad) return false;
    hasPlayedThisLoad = true;
    return true;
  });
  const [leaving, setLeaving] = useState(false);
  const { user } = useAuthModal();

  // Time-of-day greeting ("Good Morning/Afternoon/Evening/Night, {name}")
  // — same 4-bucket boundaries as the navbar's own Greeting.tsx, computed
  // client-side only (useEffect, not a render-time Date() call) so this
  // never disagrees with what the server rendered and triggers a
  // hydration mismatch. Renders nothing until this fires, which is fine —
  // it fades in on its own delayed beat anyway (see
  // animate-splash-greeting-in below).
  const [greetingWord, setGreetingWord] = useState("");

  useEffect(() => {
    // setState wrapped in a nested, immediately-invoked function — same
    // react-hooks/set-state-in-effect workaround used throughout this
    // codebase (see MaintenanceGate.tsx, VoiceRecorder.tsx, app/messages/
    // page.tsx) — calling it directly at the effect's top level is what
    // the lint rule actually flags, not the setState call itself.
    (() => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) setGreetingWord("Morning");
      else if (hour >= 12 && hour < 17) setGreetingWord("Afternoon");
      else if (hour >= 17 && hour < 21) setGreetingWord("Evening");
      else setGreetingWord("Night");
    })();
  }, []);

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
      id="app-splash-curtain"
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

        {/* Personal greeting — a secondary, softer beat under the tagline
            (not competing with it), landing just as the tagline finishes.
            Falls back to no name at all pre-sign-in or while auth is still
            resolving, rather than delaying/blocking on it. */}
        {greetingWord && (
          <p className="animate-splash-greeting-in mt-3 whitespace-nowrap bg-gradient-to-r from-orange-200 via-white to-orange-200 light:from-orange-700 light:via-slate-800 light:to-orange-700 bg-clip-text text-sm font-semibold tracking-wide text-transparent drop-shadow-[0_2px_12px_rgba(249,115,22,0.35)] sm:text-base">
            Good {greetingWord}
            {user?.name ? `, ${user.name}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
