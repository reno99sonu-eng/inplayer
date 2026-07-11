"use client";

import { Search, Mic, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const desktopPlaceholders = [
  "Search movies...",
  "Search creators...",
  "Search AI...",
  "Search live streams...",
  "Search podcasts...",
  "Search music...",
];

const mobilePlaceholders = [
  "Movies...",
  "Creators...",
  "AI...",
  "Live...",
  "Podcasts...",
  "Music...",
];

export default function NavbarSearch() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 1024);

    update();

    window.addEventListener("resize", update);

    return () => window.removeEventListener("resize", update);
  }, []);

  const activePlaceholders = isMobile
    ? mobilePlaceholders
    : desktopPlaceholders;

  const [placeholder, setPlaceholder] = useState(activePlaceholders[0]);

  useEffect(() => {
    let index = 0;

    const interval = setInterval(() => {
      index = (index + 1) % activePlaceholders.length;
      setPlaceholder(activePlaceholders[index]);
    }, 2600);

    return () => clearInterval(interval);
  }, [activePlaceholders]);

  return (
    <div
      className="
        group
        relative
        flex-1
        min-w-0
        max-w-[500px]
      "
    >
      <div
        className="
          pointer-events-none
          absolute
          -inset-2
          rounded-full
          bg-gradient-to-r
          from-orange-500/20
          via-amber-400/15
          to-orange-500/20
          blur-2xl
          opacity-50
          transition-all
          duration-500
          group-hover:opacity-90
          group-focus-within:opacity-100
        "
      />

      <Search
        size={18}
        className="
          pointer-events-none
          absolute
          left-4
          top-1/2
          -translate-y-1/2
          text-slate-400
          group-focus-within:text-orange-400
        "
      />

      <input
        type="text"
        placeholder={placeholder}
        className="
          relative
          h-12
          lg:h-14
          w-full
          min-w-0
          rounded-full
          border
          border-white/10
          bg-white/[0.05]
          backdrop-blur-[30px]
          pl-10
          pr-20
          lg:pr-24
          text-sm
          font-medium
          text-white
          placeholder:text-slate-400
          outline-none
          transition-all
          duration-500
          shadow-[0_10px_35px_rgba(0,0,0,.22)]
          hover:bg-white/[0.07]
          hover:border-orange-400/40
          focus:bg-white/[0.10]
          focus:border-orange-400
        "
      />

      <button
        type="button"
        className="
          absolute
          right-10
          lg:right-12
          top-1/2
          -translate-y-1/2
          rounded-full
          p-1
        "
      >
        <Sparkles
          size={16}
          className="text-orange-400 animate-pulse lg:h-[18px] lg:w-[18px]"
        />
      </button>

      <button
        type="button"
        className="
          absolute
          right-3
          top-1/2
          -translate-y-1/2
          rounded-full
          p-1
          hidden
          sm:block
        "
      >
        <Mic
          size={16}
          className="text-slate-300 lg:h-[18px] lg:w-[18px]"
        />
      </button>
    </div>
  );
}