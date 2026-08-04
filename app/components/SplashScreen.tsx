"use client";

import { useEffect, useState } from "react";

// The "opening the app" moment Reno asked for: the InPlayer mark + tagline
// fade/pop in over an animated glow, hold for a beat, then fade out to
// reveal the real site underneath. The real site is already mounted behind
// this overlay the whole time (SiteChrome renders {children} in parallel,
// not after this unmounts) — this is purely a visual curtain, so it never
// delays hydration, data fetching, or first paint of the actual page.
//
// Shows once per FRESH page load. SiteChrome (and this component inside
// it) is mounted once at the root of the app and stays mounted across
// client-side navigations between pages, so this naturally does not
// re-trigger every time someone clicks around the site — only on an actual
// full load/refresh, which matches "when someone opens inplayer website."
//
// Every particle position below is a fixed, hand-picked value (not
// Math.random()) on purpose: this is a client component, and randomizing
// on every render would make the server-rendered markup and the first
// client render disagree, which React flags as a hydration mismatch.
// Each particle now also carries a color so the burst reads as multi-hued
// (orange/pink/violet) instead of a single flat orange tone — alternating
// down the list keeps the mix visually even in both corners of the screen.
const PARTICLES = [
  { top: "22%", left: "28%", x: "-46px", y: "-58px", delay: "0s", size: 6, color: "bg-orange-300 light:bg-orange-500" },
  { top: "30%", left: "72%", x: "54px", y: "-40px", delay: "0.3s", size: 5, color: "bg-pink-300 light:bg-pink-500" },
  { top: "68%", left: "24%", x: "-38px", y: "50px", delay: "0.6s", size: 5, color: "bg-violet-300 light:bg-violet-500" },
  { top: "72%", left: "76%", x: "42px", y: "56px", delay: "0.15s", size: 4, color: "bg-amber-300 light:bg-amber-500" },
  { top: "50%", left: "12%", x: "-60px", y: "6px", delay: "0.45s", size: 4, color: "bg-rose-300 light:bg-rose-500" },
  { top: "48%", left: "88%", x: "60px", y: "-4px", delay: "0.75s", size: 4, color: "bg-orange-300 light:bg-orange-500" },
  { top: "38%", left: "50%", x: "0px", y: "-70px", delay: "0.9s", size: 3, color: "bg-fuchsia-300 light:bg-fuchsia-500" },
  { top: "60%", left: "50%", x: "0px", y: "70px", delay: "1.05s", size: 3, color: "bg-amber-200 light:bg-amber-400" },
];

const TAGLINE = "The Future of Entertainment";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Reduced-motion visitors get a quick, plain fade instead of the full
    // multi-second animated sequence — same content, far less time on
    // screen, no spinning/drifting elements (those are also disabled via
    // the prefers-reduced-motion CSS block in globals.css).
    //
    // Slowed down and given a longer, gentler fade-out per Reno's feedback
    // that the previous timing (1.65s hold + 0.7s fade) felt rushed — the
    // intro now holds noticeably longer and eases out over a full second
    // instead of snapping away.
    const holdMs = reducedMotion ? 500 : 2500;
    const fadeOutMs = reducedMotion ? 250 : 1000;

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
      className={`fixed inset-0 z-[999999] flex items-center justify-center overflow-hidden bg-[#05070D] light:bg-[#F1E7D0] transition-opacity duration-1000 ease-out ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {/* Ambient glow behind the mark — two overlapping, differently-hued
          blurs (warm orange + a cooler violet/pink layer) pulsing slightly
          out of phase, so the backdrop reads as genuinely colorful instead
          of a single flat orange wash. */}
      <div className="animate-splash-glow-pulse pointer-events-none absolute h-[340px] w-[340px] rounded-full bg-orange-500/30 blur-[90px] light:bg-orange-400/25 sm:h-[460px] sm:w-[460px]" />
      <div className="animate-splash-glow-pulse-alt pointer-events-none absolute h-[300px] w-[300px] translate-x-16 -translate-y-6 rounded-full bg-fuchsia-500/20 blur-[100px] light:bg-fuchsia-400/15 sm:h-[400px] sm:w-[400px]" />
      <div className="animate-splash-glow-pulse-alt pointer-events-none absolute h-[280px] w-[280px] -translate-x-16 translate-y-10 rounded-full bg-violet-500/20 blur-[100px] light:bg-violet-400/15 sm:h-[380px] sm:w-[380px]" style={{ animationDelay: "0.6s" }} />

      {/* Spinning accent ring, now slowly cycling hue so it doesn't stay a
          single flat orange for the whole intro */}
      <div className="animate-splash-ring-spin animate-splash-hue-cycle pointer-events-none absolute h-[220px] w-[220px] rounded-full border-2 border-dashed border-orange-400/40 sm:h-[300px] sm:w-[300px]" />

      {/* Drifting multi-color particles */}
      {PARTICLES.map((particle, index) => (
        <span
          key={index}
          className={`animate-splash-particle pointer-events-none absolute rounded-full ${particle.color}`}
          style={
            {
              top: particle.top,
              left: particle.left,
              width: particle.size,
              height: particle.size,
              animationDelay: particle.delay,
              "--splash-particle-x": particle.x,
              "--splash-particle-y": particle.y,
            } as React.CSSProperties
          }
        />
      ))}

      <div className="relative flex flex-col items-center px-6 text-center">
        <img
          src="/logos/inplayer-mark-dark.png"
          alt="INPLAYER"
          draggable={false}
          className="animate-splash-logo-in light:hidden h-16 w-auto object-contain drop-shadow-[0_4px_28px_rgba(249,115,22,0.45)] sm:h-20 md:h-24"
        />
        <img
          src="/logos/inplayer-mark-light.png"
          alt="INPLAYER"
          draggable={false}
          className="animate-splash-logo-in hidden light:block h-16 w-auto object-contain drop-shadow-[0_4px_20px_rgba(194,65,12,0.25)] sm:h-20 md:h-24"
        />

        <p className="animate-splash-tagline-in mt-5 text-[11px] font-bold uppercase text-orange-300 light:text-orange-700 sm:text-sm">
          {TAGLINE}
        </p>
      </div>
    </div>
  );
}
