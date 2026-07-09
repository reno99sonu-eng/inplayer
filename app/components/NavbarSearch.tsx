"use client";

import { Search, Mic, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const placeholders = [
  "Search movies...",
  "Search creators...",
  "Search AI prompts...",
  "Search podcasts...",
  "Search live events...",
  "Search brands...",
];

export default function NavbarSearch() {
  const [placeholder, setPlaceholder] = useState(placeholders[0]);

  useEffect(() => {
    let index = 0;

    const interval = setInterval(() => {
      index = (index + 1) % placeholders.length;
      setPlaceholder(placeholders[index]);
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex w-full max-w-[290px] min-w-[190px] items-center">

      <Search
        size={15}
        className="absolute left-3 text-slate-400 pointer-events-none"
      />

      <input
        type="text"
        placeholder={placeholder}
        className="
          w-full
          rounded-full
          border
          border-white/40
          bg-white/75
          backdrop-blur-2xl
          py-2
          pl-9
          pr-14
          text-[12px]
          text-slate-700
          placeholder:text-[10px]
          placeholder:text-slate-400
          placeholder:transition-opacity
          placeholder:duration-300
          outline-none
          transition-all
          duration-500
          shadow-[0_12px_35px_rgba(15,23,42,0.08)]
          hover:bg-white/90
          hover:shadow-xl
          focus:bg-white
          focus:border-orange-300
          focus:ring-4
          focus:ring-orange-100
        "
      />

      {/* AI */}

      <Sparkles
        size={14}
        className="
          absolute
          right-9
          text-orange-500
          transition-all
          duration-300
          hover:rotate-12
          cursor-pointer
        "
      />

      {/* Voice */}

      <Mic
        size={14}
        className="
          absolute
          right-3
          cursor-pointer
          text-slate-400
          transition-all
          duration-300
          hover:text-orange-500
        "
      />

    </div>
  );
}