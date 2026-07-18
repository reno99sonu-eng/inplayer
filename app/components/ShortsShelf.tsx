"use client";

import Image from "next/image";
import { type Short } from "../data/shorts";

interface ShortsShelfProps {
  items: Short[];
}

export default function ShortsShelf({ items }: ShortsShelfProps) {
  return (
    <section className="mx-auto max-w-[1800px] px-4 py-4 lg:py-8 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="text-3xl">🔥</span>

        <h2 className="text-3xl font-bold text-white">
          Shorts
        </h2>
      </div>

      {/* Mobile: single horizontally-scrolling row.
          sm and up: CSS Grid, capped at 8 columns, so columns stretch to
          fill the full width edge-to-edge and both placements of this
          component always render pixel-identical card sizes. */}
      <div
        className="
          flex
          gap-3
          overflow-x-auto
          pb-2
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden

          sm:grid
          sm:grid-cols-4
          sm:gap-3
          sm:overflow-visible

          md:grid-cols-6

          lg:grid-cols-8
        "
      >
        {items.map((short) => (
          <article
            key={short.id}
            className="
              group
              w-[130px]
              flex-shrink-0

              sm:w-auto
            "
          >
            <div className="relative aspect-[9/16] overflow-hidden rounded-2xl">
              <Image
                src={short.poster}
                alt={short.title || "InPlay short"}
                fill
                sizes="(max-width:640px)130px, 13vw"
                className="
                  object-cover
                  transition-transform
                  duration-500
                  group-hover:scale-105
                "
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />

              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/10 group-hover:opacity-100">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                  <div className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-white" />
                </div>
              </div>

              {/* Title, creator, and views live inside the image */}
              <div className="absolute bottom-0 w-full p-3">
                {short.title && (
                  <h3 className="line-clamp-2 text-xs font-bold leading-tight text-white">
                    {short.title}
                  </h3>
                )}

                <p className="mt-1 text-[10px] font-semibold text-orange-300">
                  {short.creator}
                </p>

                <p className="text-[10px] text-slate-300">
                  {short.views}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
