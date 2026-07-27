"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { type Short } from "../data/shorts";

interface ShortsShelfProps {
  items: Short[];
  renderFooter?: (short: Short) => ReactNode;
}

export default function ShortsShelf({ items, renderFooter }: ShortsShelfProps) {
  return (
    <section className="mx-auto max-w-[1800px] px-3 lg:px-8 py-3 lg:py-8">
      <div className="mb-3 lg:mb-6 flex items-center gap-2 lg:gap-3">
        <span className="text-3xl">🔥</span>

        <h2 className="text-3xl font-bold text-white light:text-slate-900">
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
          gap-2
          overflow-x-auto
          pb-1.5
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden

          sm:grid
          sm:grid-cols-4
          sm:gap-3
          sm:pb-2
          sm:overflow-visible

          md:grid-cols-6

          lg:grid-cols-8
        "
      >
        {items.map((short) => {
          const footer = renderFooter?.(short);
          const cardContent = (
            <div className="relative aspect-[9/16] overflow-hidden rounded-2xl">
              <Image
                src={short.poster}
                alt={short.title || "InPlay short"}
                fill
                sizes="(max-width:640px)108px, 13vw"
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

              {short.videoId && (
                <span
                  className="
                    absolute
                    top-2
                    left-2
                    rounded-md
                    bg-orange-500/90
                    px-1.5
                    py-0.5
                    text-[9px]
                    font-bold
                    uppercase
                    tracking-wide
                    text-white
                  "
                >
                  New
                </span>
              )}

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
          );

          const className = "group w-[108px] flex-shrink-0 sm:w-auto";

          // Real uploaded shorts open the SAME full-screen vertical Shorts
          // feed as the bottom-nav Shorts button — not the regular
          // horizontal watch page — deep-linked to start on this specific
          // short (see app/shorts/page.tsx). Example (dummy) cards stay
          // exactly as before — not clickable.
          if (short.videoId) {
            if (footer) {
              return (
                <div key={short.id} className={className}>
                  <Link href={`/shorts?v=${short.videoId}`} className="group block">
                    {cardContent}
                  </Link>
                  {footer}
                </div>
              );
            }

            return (
              <Link
                key={short.id}
                href={`/shorts?v=${short.videoId}`}
                className={className}
              >
                {cardContent}
              </Link>
            );
          }

          if (footer) {
            return (
              <div key={short.id} className={className}>
                {cardContent}
                {footer}
              </div>
            );
          }

          return (
            <article key={short.id} className={className}>
              {cardContent}
            </article>
          );
        })}
      </div>
    </section>
  );
}
