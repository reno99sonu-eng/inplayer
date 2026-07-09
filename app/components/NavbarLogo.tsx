"use client";

import { useEffect, useState } from "react";

export default function NavbarLogo() {
  const [loaded, setLoaded] = useState(false);
  const [logo, setLogo] = useState("/logos/logo-day.png");

  useEffect(() => {
    const updateLogo = () => {
      const hour = new Date().getHours();

      setLogo(
        hour >= 6 && hour < 18
          ? "/logos/logo-day.png"
          : "/logos/logo-night.png"
      );
    };

    updateLogo();

    const timer = setTimeout(() => {
      setLoaded(true);
    }, 150);

    /* Check every minute for day/night change */

    const interval = setInterval(updateLogo, 60000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  return (
    <button
      aria-label="INPLAYER Home"
      className="group relative flex items-center"
    >
      <div className="relative overflow-hidden">

        {/* Logo */}

        <img
          src={logo}
          alt="INPLAYER"
          draggable={false}
          className={`
            relative
            h-12
            md:h-14
            lg:h-16
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