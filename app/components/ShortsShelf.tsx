"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { type Short } from "../data/shorts";

interface ShortsShelfProps {
  items: Short[];
  renderFooter?: (short: Short) => ReactNode;
}

export default function ShortsShelf({ items, renderFooter }: ShortsShelfProps) {
  return (
    <section className="mx-auto max-w-[1800px] px-3 py-3 lg:px-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl sm:text-2xl">🔥</span>
        <h2 className="text-xl font-black text-white sm:text-2xl light:text-slate-900">
          Raftaar
        </h2>
      </div>

      <div
        className="
          flex
          gap-3
          overflow-x-auto
          pb-2
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden

          sm:grid
          sm:grid-cols-3
          sm:overflow-visible

          md:grid-cols-4

          lg:grid-cols-6

          xl:grid-cols-8
        "
      >
        {items.map((short) => {
          const footer = renderFooter?.(short);
          const cardContent = (
            <div className="relative aspect-[9/16] w-full min-w-[120px] max-w-[220px] mx-auto overflow-hidden rounded-2xl bg-black/40 border border-white/10 shadow-lg">
              {/* Crisp 9:16 vertical poster without haze or stretching */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={short.poster}
                alt={short.title || "Raftaar Short"}
                className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/10 group-hover:opacity-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/80 backdrop-blur-md text-white shadow-lg">
                  <div className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-white" />
                </div>
              </div>

              {short.videoId && (
                <span className="absolute top-2 left-2 rounded-md bg-orange-500/90 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-sm">
                  New
                </span>
              )}

              {/* Title, creator, and views inside vertical card */}
              <div className="absolute bottom-0 w-full p-2.5">
                {short.title && (
                  <h3 className="line-clamp-2 text-xs font-bold leading-snug text-white drop-shadow-md">
                    {short.title}
                  </h3>
                )}
                <p className="mt-1 text-[10px] font-bold text-orange-400 truncate drop-shadow-sm">
                  {short.creator}
                </p>
                <p className="text-[10px] font-semibold text-slate-300 drop-shadow-sm">{short.views}</p>
              </div>
            </div>
          );

          if (short.videoId) {
            return (
              <div key={short.id} className="group">
                <Link href={`/shorts?v=${short.videoId}`} prefetch={false}>{cardContent}</Link>
                {footer}
              </div>
            );
          }

          return (
            <div key={short.id} className="group">
              {cardContent}
              {footer}
            </div>
          );
        })}
      </div>
    </section>
  );
}
