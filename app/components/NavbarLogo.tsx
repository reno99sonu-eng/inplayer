"use client";

import { useEffect, useState } from "react";

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
      <div className="relative">

        {/* Glow */}

        <div
          className={`
            absolute
            inset-0
            rounded-2xl
            blur-xl
            transition-all
            duration-700
            ${
              loaded
                ? "opacity-60 scale-100"
                : "opacity-0 scale-75"
            }
            group-hover:opacity-100
            group-hover:scale-110
          `}
          style={{
            background:
              "radial-gradient(circle, rgba(59,130,246,0.28), rgba(168,85,247,0.16), transparent 72%)",
          }}
        />

        {/* Logo */}

        <img
          src="/logos/logo-night.png"
          alt="INPLAYER"
          className={`
            relative
            h-14
            md:h-16
            lg:h-[72px]
            w-auto
            object-contain
            select-none
            transition-all
            duration-700
            ease-out
            ${
              loaded
                ? "opacity-100 scale-100"
                : "opacity-0 scale-90"
            }
            group-hover:scale-105
            animate-float
          `}
          draggable={false}
        />
      </div>
    </button>
  );
}