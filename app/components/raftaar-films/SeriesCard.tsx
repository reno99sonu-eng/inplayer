import React from 'react';
import { FilmSeries } from '@/app/lib/raftaarFilms';
import { Play } from 'lucide-react';
import Link from 'next/link';

interface SeriesCardProps {
  series: FilmSeries;
  onClick?: () => void;
}

export default function SeriesCard({ series, onClick }: SeriesCardProps) {
  return (
    <Link href={`/raftaar-films/${series.seriesId}`} onClick={onClick}>
      <div className="rf-card-3d group relative aspect-[9/16] w-full rounded-2xl overflow-hidden cursor-pointer bg-zinc-900 border border-zinc-800 shadow-xl transition-transform duration-300 hover:scale-[1.02] hover:z-10 hover:shadow-orange-500/20">
        {/* Poster Image */}
        <img 
          src={series.posterUrl || '/placeholder-vertical.png'} 
          alt={series.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 opacity-80 group-hover:opacity-90 transition-opacity"></div>
        
        {/* Hover Play Icon Badge */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-orange-500/90 text-white p-4 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.6)] backdrop-blur-sm transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
            <Play className="w-8 h-8 fill-current ml-1" />
          </div>
        </div>
        
        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border border-white/10">
            {series.episodeCount} Episodes
          </span>
          {series.totalViews > 1000 && (
            <span className="bg-orange-500/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
              Trending
            </span>
          )}
        </div>

        {/* Bottom Content */}
        <div className="absolute bottom-0 left-0 right-0 p-4 transform transition-transform duration-300">
          <h3 className="text-white font-bold text-lg leading-tight mb-2 line-clamp-2 drop-shadow-lg">
            {series.title}
          </h3>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden bg-zinc-700 border border-zinc-500">
              <img src={series.creatorAvatarUrl || '/default-avatar.png'} alt={series.creatorName} className="w-full h-full object-cover" />
            </div>
            <span className="text-zinc-300 text-xs font-medium truncate drop-shadow-md">
              {series.creatorName}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
