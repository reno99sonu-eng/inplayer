"use client";

import Link from "next/link";
import { Play, Plus, Info } from "lucide-react";

interface FeaturedHeroButtonsProps {
  videoId: string;
  uploaderUsername: string | null;
}

export default function FeaturedHeroButtons({ videoId }: FeaturedHeroButtonsProps) {
  return (
    <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2 overflow-x-auto max-w-full no-scrollbar">
      {/* Watch Now */}
      <Link
        href={`/watch/${videoId}`}
        className="
          flex
          h-7
          sm:h-9
          flex-shrink-0
          items-center
          gap-1
          sm:gap-1.5
          whitespace-nowrap
          rounded-full
          bg-gradient-to-r
          from-orange-500
          via-amber-400
          to-yellow-300
          px-3
          sm:px-4
          text-[11px]
          sm:text-xs
          font-extrabold
          text-slate-900
          shadow-[0_4px_12px_rgba(249,115,22,.30)]
          transition-all
          duration-200
          hover:opacity-95
        "
      >
        <Play size={11} className="sm:w-3.5 sm:h-3.5" fill="currentColor" />
        Watch Now
      </Link>

      {/* Watchlist */}
      <button
        type="button"
        className="
          flex
          h-7
          sm:h-9
          flex-shrink-0
          items-center
          gap-1
          sm:gap-1.5
          whitespace-nowrap
          rounded-full
          border
          border-white/15
          bg-white/10
          px-3
          sm:px-4
          text-[11px]
          sm:text-xs
          font-bold
          text-white
          backdrop-blur-md
          transition-all
          duration-200
          hover:border-orange-400/40
          hover:bg-white/15
        "
      >
        <Plus size={11} className="sm:w-3.5 sm:h-3.5" />
        Watchlist
      </button>

      {/* Details opens the video's dedicated details page */}
      <Link
        href={`/watch/${videoId}/details`}
        className="
          flex
          h-7
          sm:h-9
          flex-shrink-0
          items-center
          gap-1
          sm:gap-1.5
          whitespace-nowrap
          rounded-full
          border
          border-white/15
          bg-white/10
          px-3
          sm:px-4
          text-[11px]
          sm:text-xs
          font-bold
          text-white
          backdrop-blur-md
          transition-all
          duration-200
          hover:border-cyan-400/40
          hover:bg-white/15
        "
      >
        <Info size={11} className="sm:w-3.5 sm:h-3.5" />
        Details
      </Link>
    </div>
  );
}
