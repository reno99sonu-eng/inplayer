"use client";

import { useEffect } from "react";
import { notFound } from "next/navigation";
import { playables } from "../../data/playables";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function GamePlayerPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  
  const game = playables.find((p) => p.id === gameId);

  useEffect(() => {
    if (game) {
      try {
        const stored = localStorage.getItem("inplayer_recent_games");
        let history: string[] = stored ? JSON.parse(stored) : [];
        
        // Remove if already exists so we can push it to front
        history = history.filter((id) => id !== game.id);
        
        // Add to front of history
        history.unshift(game.id);
        
        // Keep only top 20
        history = history.slice(0, 20);
        
        localStorage.setItem("inplayer_recent_games", JSON.stringify(history));
      } catch (err) {
        console.error("Failed to save game history:", err);
      }
    }
  }, [game]);

  if (!game) {
    return notFound();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#050816] light:bg-[#F4ECDA]">
      <div className="flex items-center gap-4 p-4 lg:px-8 border-b border-white/5 light:border-black/5">
        <button 
          onClick={() => window.history.back()}
          className="p-2 rounded-full hover:bg-white/10 light:hover:bg-black/10 transition text-white light:text-slate-900 cursor-pointer"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white light:text-slate-900">{game.title}</h1>
          <p className="text-sm text-slate-400 light:text-slate-600">by {game.developer}</p>
        </div>
      </div>
      
      <div className="flex-1 w-full relative">
        <iframe
          src={game.iframeUrl}
          className="absolute inset-0 w-full h-full border-none"
          allow="fullscreen; autoplay; encrypted-media"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          loading="lazy"
        />
      </div>
    </div>
  );
}
