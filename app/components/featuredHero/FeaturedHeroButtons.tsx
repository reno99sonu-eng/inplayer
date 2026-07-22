"use client";

import { Play, Plus, Info } from "lucide-react";

export default function FeaturedHeroButtons() {
  return (
    <div className="flex flex-wrap items-center gap-3">

      {/* Watch Now */}
      <button
        className="
          flex
          items-center
          gap-2
          rounded-full
          bg-gradient-to-r
          from-orange-500
          via-amber-400
          to-yellow-300
          px-5
          py-2.5
          text-sm
          font-bold
          text-slate-900
          shadow-[0_10px_25px_rgba(249,115,22,.30)]
          transition-all
          duration-300
          hover:scale-105
        "
      >
        <Play size={16} fill="currentColor" />
        Watch Now
      </button>

      {/* Watchlist */}
      <button
        className="
          flex
          items-center
          gap-2
          rounded-full
          border
          border-white/10
          bg-white/5
          px-5
          py-2.5
          text-sm
          font-semibold
          text-white
          backdrop-blur-xl
          transition-all
          duration-300
          hover:border-orange-400/40
          hover:bg-white/10
        "
      >
        <Plus size={16} />
        Watchlist
      </button>

      {/* Details */}
      <button
        className="
          flex
          items-center
          gap-2
          rounded-full
          border
          border-white/10
          bg-white/5
          px-5
          py-2.5
          text-sm
          font-semibold
          text-white
          backdrop-blur-xl
          transition-all
          duration-300
          hover:border-cyan-400/40
          hover:bg-white/10
        "
      >
        <Info size={16} />
        Details
      </button>

    </div>
  );
}