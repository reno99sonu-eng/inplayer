import React from 'react';
import { FilmSeries } from '@/app/lib/raftaarFilms';
import SeriesCard from './SeriesCard';
import './RaftaarFilms3DStyles.css';

interface SeriesGridProps {
  series: FilmSeries[];
  loading?: boolean;
  onSeriesClick?: (s: FilmSeries) => void;
}

export default function SeriesGrid({ series, loading, onSeriesClick }: SeriesGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-3.5 sm:gap-4 md:gap-6">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="aspect-[9/14] sm:aspect-[9/15] rounded-xl sm:rounded-2xl bg-zinc-900/60 animate-pulse border border-zinc-800/60 shadow-lg relative overflow-hidden" />
            <div className="h-3.5 bg-zinc-900/60 rounded w-3/4 animate-pulse mt-1" />
            <div className="h-3 bg-zinc-900/40 rounded w-1/3 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <div className="w-full py-20 flex flex-col items-center justify-center text-center rf-glass rounded-3xl p-8 border border-white/10 my-4">
        <div className="w-20 h-20 bg-orange-500/15 border border-orange-500/30 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-orange-500/10">
          <span className="text-3xl">🎬</span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Series Found</h3>
        <p className="text-zinc-400 max-w-md text-sm leading-relaxed">
          We couldn't find any micro-drama series matching your filters or search term. Try selecting a different genre or browse all.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-3.5 sm:gap-4 md:gap-6">
      {series.map((s) => (
        <SeriesCard key={s.seriesId} series={s} onClick={() => onSeriesClick?.(s)} />
      ))}
    </div>
  );
}
