"use client";

import Image from "next/image";
import { shorts } from "../data/shorts";

export default function ShortsShelf() {
  return (
    <section className="mx-auto max-w-[1800px] px-4 py-8 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="text-3xl">🔥</span>

        <h2 className="text-3xl font-bold text-white">
          Shorts
        </h2>
      </div>

      {/* Mobile: Horizontal Scroll | Desktop: Original Grid */}
      <div
        className="
          flex
          gap-4
          overflow-x-auto
          snap-x
          snap-mandatory
          pb-2
          scrollbar-hide

          sm:grid
          sm:grid-cols-3
          sm:gap-4

          md:grid-cols-4

          lg:grid-cols-5
        "
      >
        {shorts.map((short) => (
          <article
            key={short.id}
            className="
              group
              w-[180px]
              flex-shrink-0
              snap-start

              sm:w-auto
            "
          >
            <div className="relative aspect-[9/16] overflow-hidden rounded-2xl">
              <Image
                src={short.poster}
                alt={short.title}
                fill
                sizes="(max-width:640px)180px, 20vw"
                className="
                  object-cover
                  transition-transform
                  duration-500
                  group-hover:scale-105
                "
              />
            </div>

            <h3
              className="
                mt-3
                line-clamp-2
                text-sm
                font-semibold
                text-white
              "
            >
              {short.title}
            </h3>

            <p
              className="
                mt-1
                text-sm
                text-slate-400
              "
            >
              {short.views}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}