"use client";

import { Play, Plus, Clapperboard } from "lucide-react";

export default function HeroButtons() {
  return (
    <div className="mt-10 flex flex-wrap gap-4">

      <button
        className="
          group
          flex
          items-center
          gap-3
          rounded-full
          bg-gradient-to-r
          from-orange-500
          to-red-500
          px-7
          py-4
          font-bold
          text-white
          shadow-[0_20px_40px_rgba(249,115,22,0.35)]
          transition-all
          duration-300
          hover:-translate-y-1
          hover:scale-[1.02]
        "
      >
        <Play size={18} fill="white" />
        Watch Now
      </button>

      <button
        className="
          flex
          items-center
          gap-3
          rounded-full
          border
          border-slate-300
          bg-white/70
          px-7
          py-4
          font-semibold
          text-slate-700
          backdrop-blur-xl
          transition-all
          duration-300
          hover:bg-white
          hover:shadow-xl
        "
      >
        <Clapperboard size={18} />
        Watch Trailer
      </button>

      <button
        className="
          flex
          items-center
          gap-3
          rounded-full
          border
          border-slate-300
          bg-white/70
          px-7
          py-4
          font-semibold
          text-slate-700
          backdrop-blur-xl
          transition-all
          duration-300
          hover:bg-white
          hover:shadow-xl
        "
      >
        <Plus size={18} />
        My List
      </button>

    </div>
  );
}