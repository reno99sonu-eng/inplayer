import React, { useRef } from 'react';

export interface TopCreator {
  creatorId: string;
  name: string;
  avatarUrl: string;
}

interface CreatorStoryStripProps {
  creators: TopCreator[];
  selectedCreatorId?: string | null;
  onSelectCreator: (id: string | null) => void;
}

export default function CreatorStoryStrip({ creators, selectedCreatorId, onSelectCreator }: CreatorStoryStripProps) {
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

  if (!creators || creators.length === 0) return null;

  return (
    <div className="w-full py-2.5 sm:py-3 mb-1 border-b border-white/[0.06]">
      <div 
        ref={scrollRef}
        className="flex space-x-3.5 sm:space-x-5 overflow-x-auto scrollbar-hide px-3 sm:px-6 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* ALL / Everyone Option */}
        <button 
          onClick={() => onSelectCreator(null)}
          className="flex flex-col items-center flex-shrink-0 group w-14 sm:w-16 transition-transform active:scale-95"
        >
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-1.5 transition-all shadow-md ${
            selectedCreatorId === null 
              ? 'bg-gradient-to-tr from-orange-500 via-amber-500 to-yellow-400 text-slate-950 shadow-[0_0_15px_rgba(249,115,22,0.55)] scale-105' 
              : 'bg-white/[0.07] border-2 border-white/15 text-zinc-300 group-hover:border-orange-400/50 group-hover:text-white'
          }`}>
            <span className={`text-xs font-black tracking-wider ${selectedCreatorId === null ? 'text-slate-950 font-black' : 'text-zinc-300'}`}>ALL</span>
          </div>
          <span className={`text-[10px] sm:text-[11px] text-center w-full truncate leading-tight ${selectedCreatorId === null ? 'text-orange-400 font-bold' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
            Everyone
          </span>
        </button>

        {/* Creator Avatars */}
        {creators.map(creator => {
          const isSelected = selectedCreatorId === creator.creatorId;
          return (
            <button 
              key={creator.creatorId}
              onClick={() => onSelectCreator(isSelected ? null : creator.creatorId)}
              className="flex flex-col items-center flex-shrink-0 group w-14 sm:w-16 transition-transform active:scale-95"
            >
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full p-[2px] mb-1.5 transition-all ${
                isSelected
                  ? 'bg-gradient-to-tr from-orange-500 via-amber-400 to-yellow-400 shadow-[0_0_15px_rgba(249,115,22,0.55)] scale-105'
                  : 'bg-gradient-to-tr from-zinc-700 via-zinc-800 to-zinc-700 group-hover:from-orange-500/60 group-hover:to-amber-400/60'
              }`}>
                <div className="w-full h-full bg-zinc-950 rounded-full border border-black/80 overflow-hidden">
                  <img 
                    src={creator.avatarUrl || '/avatars/avatar.png'} 
                    alt={creator.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    draggable={false} 
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src !== '/avatars/avatar.png') {
                        target.src = '/avatars/avatar.png';
                      }
                    }}
                  />
                </div>
              </div>
              <span className={`text-[10px] sm:text-[11px] text-center w-full truncate leading-tight ${isSelected ? 'text-orange-400 font-bold' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                {creator.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  );
}
