import React, { useRef } from 'react';
import { FILM_GENRES } from '@/app/lib/raftaarFilms';

interface GenreBarProps {
  selectedGenre: string;
  onSelectGenre: (genre: string) => void;
}

export default function GenreBar({ selectedGenre, onSelectGenre }: GenreBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  let isDown = false;
  let startX: number;
  let scrollLeft: number;

  const onMouseDown = (e: React.MouseEvent) => {
    isDown = true;
    if (scrollRef.current) {
      startX = e.pageX - scrollRef.current.offsetLeft;
      scrollLeft = scrollRef.current.scrollLeft;
    }
  };

  const onMouseLeave = () => {
    isDown = false;
  };

  const onMouseUp = () => {
    isDown = false;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDown) return;
    e.preventDefault();
    if (scrollRef.current) {
      const x = e.pageX - scrollRef.current.offsetLeft;
      const walk = (x - startX) * 2;
      scrollRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const genres = ['All', ...FILM_GENRES];

  return (
    <div className="w-full relative py-1">
      <div 
        ref={scrollRef}
        className="flex items-center space-x-2 sm:space-x-2.5 overflow-x-auto scrollbar-hide px-3 sm:px-6 py-2 cursor-grab active:cursor-grabbing snap-x select-none"
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {genres.map((genre) => {
          const isActive = selectedGenre === genre;
          return (
            <button
              key={genre}
              onClick={() => onSelectGenre(genre)}
              className={`rf-chip snap-start whitespace-nowrap px-3.5 py-1.5 sm:px-4 sm:py-1.5 rounded-full text-xs font-bold transition-all duration-200 active:scale-95 ${
                isActive 
                  ? 'rf-chip-active bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-[0_0_12px_rgba(249,115,22,0.45)] border border-amber-300/60 font-black'
                  : 'bg-white/[0.06] text-zinc-300 border border-white/[0.08] hover:bg-white/[0.12] hover:text-white'
              }`}
            >
              {genre}
            </button>
          );
        })}
      </div>
    </div>
  );
}
