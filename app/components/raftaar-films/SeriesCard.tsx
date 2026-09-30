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
      className="block outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-2xl group"
    >
      <div className="rf-card-3d-lux relative aspect-[9/16] w-full rounded-2xl overflow-hidden cursor-pointer bg-zinc-950 border border-zinc-800/80 shadow-2xl transition-all duration-300">
        {/* Poster Image */}
        <img 
          src={posterSrc} 
          alt={series.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== '/placeholder-vertical.svg') {
              target.src = '/placeholder-vertical.svg';
            }
          }}
        />
        
        {/* Cinematic Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-85 group-hover:opacity-95 transition-opacity" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />
        
        {/* 3D Hover Play Icon Badge with Golden Amber Glow */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="bg-gradient-to-tr from-[#FF7A18] to-[#FFA800] text-white p-4 rounded-full shadow-[0_0_30px_rgba(249,115,22,0.7)] backdrop-blur-md transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-7 h-7 fill-current ml-0.5" />
          </div>
        </div>
        
        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          <span className="bg-black/65 backdrop-blur-md text-slate-100 text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider border border-white/15 shadow-md">
            {series.episodeCount} Episodes
          </span>
          {series.totalViews > 500 && (
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider shadow-[0_0_12px_rgba(249,115,22,0.4)]">
              Trending
            </span>
          )}
        </div>

        {/* Bottom Content with 3D Depth */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5 sm:p-4 z-10 transform transition-transform duration-300">
          {series.genre && (
            <span className="text-[10px] font-bold text-amber-300/90 tracking-wide uppercase mb-1 block">
              {series.genre}
            </span>
          )}
          <h3 className="text-white font-bold text-base sm:text-lg leading-tight mb-2 line-clamp-2 drop-shadow-lg group-hover:text-orange-200 transition-colors">
            {series.title}
          </h3>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-800 border border-orange-500/40 flex-shrink-0">
              <img 
                src={series.creatorAvatarUrl || '/avatars/avatar.png'} 
                alt={series.creatorName} 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== '/avatars/avatar.png') {
                    target.src = '/avatars/avatar.png';
                  }
                }}
              />
            </div>
            <span className="text-zinc-300 text-xs font-semibold truncate drop-shadow-md">
              {series.creatorName}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
