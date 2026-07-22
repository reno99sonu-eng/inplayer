"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// The brand mark in the top navbar. On load, the full INPLAYER lockup
// "rolls in" (the PLAYER wordmark wipes out beside the IN triangle), holds
// briefly, then rolls back so only the IN triangle remains — and it replays
// that reveal on hover. The triangle is always present and clicking anywhere
// on the mark returns to the homepage.
//
// It's built from two slices of the same lockup (mark-triangle.png +
// mark-player.png), shown at the same height and placed side by side, so
// when both are visible they reconstruct the original logo pixel-for-pixel
// and stay perfectly aligned at every screen size.
export default function NavbarLogo() {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const hovering = useRef(false);

  useEffect(() => {
    // Intro: roll the wordmark in shortly after mount, then roll it back —
    // unless the user is hovering right then (don't yank it away mid-hover).
    const rollIn = setTimeout(() => setRevealed(true), 300);
    const rollBack = setTimeout(() => {
      if (!hovering.current) setRevealed(false);
    }, 2200);
    return () => {
      clearTimeout(rollIn);
      clearTimeout(rollBack);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => router.push("/")}
      onMouseEnter={() => {
        hovering.current = true;
        setRevealed(true);
      }}
      onMouseLeave={() => {
        hovering.current = false;
        setRevealed(false);
      }}
      aria-label="INPLAYER — Home"
      className="group relative flex items-center select-none"
    >
      {/* IN triangle — the persistent mark */}
      <img
        src="/logos/mark-triangle.png"
        alt="INPLAYER"
        draggable={false}
        className="
          h-8 md:h-9 lg:h-10 w-auto object-contain
          drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]
          transition-transform duration-300
          group-hover:scale-[1.04] group-active:scale-95
        "
      />

      {/* PLAYER wordmark — wipes in beside the triangle, then wipes back */}
      <span
        className="
          overflow-hidden
          transition-[max-width,opacity,margin-left]
          duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]
        "
        style={{
          maxWidth: revealed ? "150px" : "0px",
          opacity: revealed ? 1 : 0,
          marginLeft: revealed ? "7px" : "0px",
        }}
      >
        <img
          src="/logos/mark-player.png"
          alt=""
          draggable={false}
          className="h-8 md:h-9 lg:h-10 w-auto max-w-none object-contain block"
        />
      </span>

      {/* Premium light sweep across the mark on hover */}
      <span className="pointer-events-none absolute inset-0 overflow-hidden">
        <span
          className="
            absolute -left-16 top-0 h-full w-10 -skew-x-12
            bg-white/25 blur-md
            opacity-0 group-hover:opacity-100 group-hover:animate-glassSweep
          "
        />
      </span>
    </button>
  );
}
