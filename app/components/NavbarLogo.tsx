"use client";

import { useEffect, useState } from "react";

// Single logo for now — no night version exists yet.
// Once a real night version is made, restore the day/night detection
// logic (kept below, commented out) instead of this fixed constant.
const LOGO_SRC = "/logos/logo.png";

/*
// Day/night version — restore this once a real night logo exists:
//
// const [logo, setLogo] = useState("/logos/logo-day.png");
//
// useEffect(() => {
//   const updateLogo = () => {
//     const hour = new Date().getHours();
//     setLogo(
//       hour >= 6 && hour < 18
//         ? "/logos/logo-day.png"
//         : "/logos/logo-night.png"
//     );
//   };
//
//   updateLogo();
//   const interval = setInterval(updateLogo, 60000);
//   return () => clearInterval(interval);
// }, []);
*/

export default function NavbarLogo() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true);
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  return (
    <button
      aria-label="INPLAYER Home"
      className="group relative flex items-center"
    >
      <div className="relative overflow-hidden">

        {/* Logo */}

        <img
          src={LOGO_SRC}
          alt="INPLAYER"
          draggable={false}
          className={`
            relative
            h-8
            md:h-9
            lg:h-10
            w-auto
            object-contain
            select-none
            transition-all
            duration-1000
            ease-in-out
            ${
              loaded
                ? "opacity-100 scale-100 animate-logoFade"
                : "opacity-0 scale-95"
            }
            group-hover:scale-105
            animate-logoFloat
          `}
        />

        {/* Light Sweep */}

        <div className="pointer-events-none absolute inset-0 overflow-hidden">

          <div
            className="
              absolute
              -left-20
              top-0
              h-full
              w-10
              -skew-x-12
              bg-white/30
              blur-md
              animate-glassSweep
            "
          />

        </div>

      </div>
    </button>
  );
}
