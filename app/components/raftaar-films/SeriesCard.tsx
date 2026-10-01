import React from 'react';
import { FilmSeries } from '@/app/lib/raftaarFilms';
import { Play } from 'lucide-react';
import Link from 'next/link';

interface SeriesCardProps {
  series: FilmSeries;
  onClick?: () => void;
}

export default function SeriesCard({ series, onClick }: SeriesCardProps) {
  const posterSrc =
    series.posterUrl && !series.posterUrl.includes("photo-1536440136628-849c177e76a1")
      ? series.posterUrl
      : "/placeholder-vertical.svg";

  return (
    <Link
      href={`/raftaar-films/${series.seriesId}`}
      onClick={onClick}
      className="block outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-xl sm:rounded-2xl group transition-transform duration-200"
    >
      <div className="w-full flex flex-col cursor-pointer">
        {/* Poster Image Container - Clean artwork without text or badges */}
        <div className="relative aspect-[9/14] sm:aspect-[9/15] w-full rounded-xl sm:rounded-2xl overflow-hidden bg-zinc-900 border border-white/[0.08] group-hover:border-orange-500/40 shadow-lg group-hover:shadow-[0_12px_28px_rgba(249,115,22,0.2)] transition-all duration-300">
          <img 
            src={posterSrc} 
            alt={series.title}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src !== '/placeholder-vertical.svg') {
                target.src = '/placeholder-vertical.svg';
              }
            }}
          />
          
          {/* Subtle Hover Play Button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-black/25">
            <div className="bg-gradient-to-tr from-[#FF7A18] to-[#FFA800] text-white p-3 sm:p-3.5 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.6)] transform scale-75 group-hover:scale-100 transition-transform duration-300">
              <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />
            </div>
          </div>
        </div>

        {/* Title & Episodes under the poster (Matching Image 2) */}
        <div className="pt-2 sm:pt-2.5 px-0.5">
          <h3 className="text-white font-bold text-xs sm:text-sm leading-snug line-clamp-1 group-hover:text-orange-300 transition-colors drop-shadow-sm">
            {series.title}
          </h3>
          <p className="text-[11px] sm:text-xs text-zinc-400 font-normal mt-0.5">
            {series.episodeCount} {series.episodeCount === 1 ? 'episode' : 'episodes'}
          </p>
        </div>
      </div>
    </Link>
  );
}
