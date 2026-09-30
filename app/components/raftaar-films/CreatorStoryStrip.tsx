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
    <div className="w-full py-4 mb-2 border-b border-zinc-800/50">
      <div 
        ref={scrollRef}
        className="flex space-x-6 overflow-x-auto scrollbar-hide px-4 md:px-8 cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <button 
          onClick={() => onSelectCreator(null)}
          className="flex flex-col items-center flex-shrink-0 group w-16"
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 transition-all ${
            selectedCreatorId === null 
              ? 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]' 
              : 'bg-zinc-800 border-2 border-zinc-700 group-hover:border-zinc-500'
          }`}>
            <span className={`font-bold ${selectedCreatorId === null ? 'text-white' : 'text-zinc-400'}`}>ALL</span>
          </div>
          <span className={`text-[10px] text-center w-full truncate ${selectedCreatorId === null ? 'text-orange-500 font-bold' : 'text-zinc-400'}`}>
            Everyone
          </span>
        </button>

        {creators.map(creator => {
          const isSelected = selectedCreatorId === creator.creatorId;
          return (
            <button 
              key={creator.creatorId}
              onClick={() => onSelectCreator(isSelected ? null : creator.creatorId)}
              className="flex flex-col items-center flex-shrink-0 group w-16"
            >
              <div className={`w-16 h-16 rounded-full p-[2px] mb-2 transition-all ${
                isSelected
                  ? 'bg-gradient-to-tr from-orange-600 via-orange-400 to-yellow-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]'
                  : 'bg-gradient-to-tr from-zinc-700 to-zinc-600 group-hover:from-orange-500/50 group-hover:to-orange-400/50'
              }`}>
                <div className="w-full h-full bg-zinc-900 rounded-full border-2 border-black overflow-hidden">
                  <img 
                    src={creator.avatarUrl || '/avatars/avatar.png'} 
                    alt={creator.name} 
                    className="w-full h-full object-cover" 
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
              <span className={`text-[10px] text-center w-full truncate ${isSelected ? 'text-orange-500 font-bold' : 'text-zinc-400'}`}>
                {creator.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  );
}
