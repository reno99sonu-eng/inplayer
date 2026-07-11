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
  const isMobile =
  typeof window !== "undefined" && window.innerWidth < 1024;

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
    <div className="group relative w-full max-w-[500px] min-w-[180px] sm:min-w-[220px] lg:min-w-[260px]">

      {/* Premium Glow */}
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

      {/* Search Icon */}
      <Search
        size={18}
        className="
          pointer-events-none
          absolute
          left-5
          top-1/2
          -translate-y-1/2
          text-slate-400
          transition-colors
          duration-300
          group-focus-within:text-orange-400
        "
      />

      {/* Search Input */}
      <input
        type="text"
        placeholder={placeholder}
        className="
          relative
          h-14
          w-full
          rounded-full
          border
          border-white/10
          bg-white/[0.05]
          backdrop-blur-[30px]
          pl-10
          pr-24
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
          hover:shadow-[0_0_35px_rgba(249,115,22,.18)]
          focus:bg-white/[0.10]
          focus:border-orange-400
          focus:shadow-[0_0_60px_rgba(249,115,22,.35)]
        "
      />

      {/* AI Button */}
      <button
        type="button"
        className="
          absolute
          right-12
          top-1/2
          -translate-y-1/2
          rounded-full
          p-1.5
          transition-all
          duration-300
          hover:scale-110
          hover:bg-orange-500/10
        "
      >
        <Sparkles
          size={18}
          className="text-orange-400 animate-pulse"
        />
      </button>

      {/* Voice Button */}
      <button
        type="button"
        className="
          absolute
          right-4
          top-1/2
          -translate-y-1/2
          rounded-full
          p-1.5
          transition-all
          duration-300
          hover:scale-110
          hover:bg-white/10
        "
      >
        <Mic
          size={18}
          className="text-slate-300 transition-colors hover:text-orange-400"
        />
      </button>

    </div>
  );
}