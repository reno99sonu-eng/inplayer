"use client";

import { Play, Plus, Info } from "lucide-react";

export default function FeaturedHeroButtons() {
  return (
    <div className="flex flex-wrap items-center gap-4">

      {/* Watch Now */}
      <button
        className="
          flex
          items-center
          gap-3
          rounded-full
          bg-gradient-to-r
          from-orange-500
          via-amber-400
          to-yellow-300
          px-8
          py-4
          font-bold
          text-slate-900
          shadow-[0_15px_45px_rgba(249,115,22,.35)]
          transition-all
          duration-300
          hover:scale-105
        "
      >
        <Play size={20} fill="currentColor" />
        Watch Now
      </button>

      {/* Watchlist */}
      <button
        className="
          flex
          items-center
          gap-3
          rounded-full
          border
          border-white/10
          bg-white/5
          px-8
          py-4
          font-semibold
          text-white
          backdrop-blur-xl
          transition-all
          duration-300
          hover:border-orange-400/40
          hover:bg-white/10
        "
      >
        <Plus size={20} />
        Watchlist
      </button>

      {/* Details */}
      <button
        className="
          flex
          items-center
          gap-3
          rounded-full
          border
          border-white/10
          bg-white/5
          px-8
          py-4
          font-semibold
          text-white
          backdrop-blur-xl
          transition-all
          duration-300
          hover:border-cyan-400/40
          hover:bg-white/10
        "
      >
        <Info size={20} />
        Details
      </button>

    </div>
  );
}