"use client";

import { playables } from "../data/playables";
import Link from "next/link";
import { Gamepad2, Play } from "lucide-react";

export default function InJoyPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#050816] light:bg-[#F4ECDA] p-4 lg:p-8">
      <div className="max-w-[1800px] mx-auto">
        <div className="mb-8 flex items-center gap-3">
          <Gamepad2 className="text-orange-500" size={32} />
          <h1 className="text-3xl font-black text-white sm:text-4xl light:text-slate-900">
            InJoy
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
          {playables.map((game) => (
            <Link
              key={game.id}
              href={`/play/${game.id}`}
              className="group relative flex aspect-square cursor-pointer flex-col overflow-hidden rounded-2xl bg-white/5 light:bg-black/5"
            >
              <img
                src={game.thumbnail}
                alt={game.title}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-80" />
              
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]">
                  <Play size={24} className="ml-1" />
                </div>
              </div>
              
              <div className="relative z-10 mt-auto p-3">
                <h3 className="line-clamp-1 text-sm font-bold text-white drop-shadow-md">
                  {game.title}
                </h3>
                <p className="line-clamp-1 text-xs text-slate-300 drop-shadow-md">
                  {game.developer}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
