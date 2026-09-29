import React from 'react';
import { FilmSeries } from '@/app/lib/raftaarFilms';
import SeriesCard from './SeriesCard';

interface SeriesGridProps {
  series: FilmSeries[];
  loading?: boolean;
  onSeriesClick?: (s: FilmSeries) => void;
}

export default function SeriesGrid({ series, loading, onSeriesClick }: SeriesGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="aspect-[9/16] rounded-2xl bg-zinc-800/50 animate-pulse border border-zinc-700/50"></div>
        ))}
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <div className="w-full py-20 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
          <span className="text-3xl">🎬</span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Series Found</h3>
        <p className="text-zinc-400 max-w-md">We couldn't find any micro-series matching your criteria. Try adjusting your filters or search term.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {series.map((s) => (
        <SeriesCard key={s.seriesId} series={s} onClick={() => onSeriesClick?.(s)} />
      ))}
    </div>
  );
}
