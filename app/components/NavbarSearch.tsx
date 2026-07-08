"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

const placeholders = [
  "Search movies...",
  "Search TV shows...",
  "Search creators...",
  "Search live TV...",
  "Search gaming...",
  "Search music...",
];

export default function NavbarSearch() {
  const [placeholder, setPlaceholder] = useState(placeholders[0]);

  useEffect(() => {
    let index = 0;

    const interval = setInterval(() => {
      index = (index + 1) % placeholders.length;
      setPlaceholder(placeholders[index]);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative hidden lg:flex items-center">

      {/* Left Search Icon */}

      <Search
        size={18}
        className="absolute left-5 text-slate-400 pointer-events-none"
      />

      <input
        type="text"
        placeholder={placeholder}
        className="
          w-[240px]
          xl:w-[320px]
          rounded-full
          border
          border-white/50
          bg-white/70
          backdrop-blur-xl
          py-3
          pl-12
          pr-12
          text-[14px]
          text-slate-700
          placeholder:text-slate-400
          outline-none
          transition-all
          duration-500
          shadow-[0_8px_30px_rgba(15,23,42,0.06)]
          hover:bg-white/90
          hover:shadow-xl
          focus:w-[360px]
          focus:bg-white
          focus:border-orange-300
          focus:ring-4
          focus:ring-orange-100
        "
      />

      {/* Right Search Icon */}

      <Search
        size={17}
        className="
          absolute
          right-5
          text-slate-400
          pointer-events-none
          transition
          duration-300
        "
      />

    </div>
  );
}