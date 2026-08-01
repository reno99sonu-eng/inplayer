"use client";

import Link from "next/link";
import { Play, Plus, Info } from "lucide-react";

interface FeaturedHeroButtonsProps {
  videoId: string;
  uploaderUsername: string | null;
}

export default function FeaturedHeroButtons({ videoId, uploaderUsername }: FeaturedHeroButtonsProps) {
  return (
    <div className="flex flex-nowrap items-center gap-2 sm:gap-3 overflow-x-auto max-w-full no-scrollbar pb-1">
      {/* Watch Now */}
      <Link
        href={`/watch/${videoId}`}
        className="
          flex
          flex-shrink-0
          items-center
          gap-1.5
          sm:gap-2
          whitespace-nowrap
          rounded-full
          bg-gradient-to-r
          from-orange-500
          via-amber-400
          to-yellow-300
          px-3.5
          py-2
          sm:px-5
          sm:py-2.5
          text-xs
          sm:text-sm
          font-bold
          text-slate-900
          shadow-[0_10px_25px_rgba(249,115,22,.30)]
          transition-all
          duration-300
          hover:scale-105
        "
      >
        <Play size={14} className="sm:w-4 sm:h-4" fill="currentColor" />
        Watch Now
      </Link>

      {/* Watchlist */}
      <button
        type="button"
        className="
          flex
          flex-shrink-0
          items-center
          gap-1.5
          sm:gap-2
          whitespace-nowrap
          rounded-full
          border
          border-white/10
          bg-white/5
          px-3.5
          py-2
          sm:px-5
          sm:py-2.5
          text-xs
          sm:text-sm
          font-semibold
          text-white
          backdrop-blur-xl
          transition-all
          duration-300
          hover:border-orange-400/40
          hover:bg-white/10
        "
      >
        <Plus size={14} className="sm:w-4 sm:h-4" />
        Watchlist
      </button>

      {/* Details opens the video's dedicated details page */}
      <Link
        href={`/watch/${videoId}/details`}
        className="
          flex
          flex-shrink-0
          items-center
          gap-1.5
          sm:gap-2
          whitespace-nowrap
          rounded-full
          border
          border-white/10
          bg-white/5
          px-3.5
          py-2
          sm:px-5
          sm:py-2.5
          text-xs
          sm:text-sm
          font-semibold
          text-white
          backdrop-blur-xl
          transition-all
          duration-300
          hover:border-cyan-400/40
          hover:bg-white/10
        "
      >
        <Info size={14} className="sm:w-4 sm:h-4" />
        Details
      </Link>
    </div>
  );
}
