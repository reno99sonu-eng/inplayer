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
    <div className="w-full relative overflow-hidden py-4">
      <div 
        ref={scrollRef}
        className="flex space-x-3 overflow-x-auto scrollbar-hide px-4 md:px-8 cursor-grab active:cursor-grabbing snap-x"
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
              className={`snap-start whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                isActive 
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)] border border-orange-400'
                  : 'bg-zinc-800/50 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700/80 hover:text-white'
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
