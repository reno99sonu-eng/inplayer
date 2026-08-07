"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { playables, type Playable } from "../data/playables";

export default function PlayablesShelf() {
  const [sortedPlayables, setSortedPlayables] = useState<Playable[]>(playables);
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem("inplayer_recent_games");
      if (stored) {
        const history: string[] = JSON.parse(stored);
        setRecentIds(new Set(history));
        
        // Move recently played games to the front
        const recent = playables.filter((p) => history.includes(p.id));
        const others = playables.filter((p) => !history.includes(p.id));
        
        // Sort recent games by most recently played (order in history array)
        recent.sort((a, b) => history.indexOf(b.id) - history.indexOf(a.id));
        
        setSortedPlayables([...recent, ...others]);
      }
    } catch (err) {
      console.error("Failed to load game history:", err);
    }
  }, []);

  if (playables.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1800px] px-3 py-3 lg:px-8">
      <div className="mb-3 flex items-center gap-2">
        <Gamepad2 className="text-orange-500" size={26} />
        <h2 className="text-xl font-black text-white sm:text-2xl light:text-slate-900">
          InJoy
        </h2>
      </div>

      <div
        className="
          flex
          gap-4
          overflow-x-auto
          pb-4
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {sortedPlayables.map((game) => {
          const isRecent = recentIds.has(game.id);

          return (
            <Link 
              key={game.id} 
              href={`/play/${game.id}`}
              prefetch={false}
              className="group flex flex-col w-[140px] sm:w-[160px] flex-shrink-0"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black/40 border border-white/10 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={game.thumbnail}
                  alt={game.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60" />

                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/40 group-hover:opacity-100">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white shadow-lg transition-transform group-hover:scale-110">
                    <Gamepad2 size={24} className="text-white drop-shadow-md" />
                  </div>
                </div>

                {isRecent && (
                  <span className="absolute top-2 left-2 rounded-md bg-blue-500/90 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-white shadow-sm">
                    Recently Played
                  </span>
                )}
              </div>

              <div className="mt-2 px-1">
                <h3 className="line-clamp-1 text-sm font-bold text-white light:text-slate-900">
                  {game.title}
                </h3>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-400 light:text-slate-600 truncate">
                  {game.developer}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
