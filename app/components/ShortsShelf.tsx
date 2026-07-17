"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { shorts, type Short } from "../data/shorts";

export default function ShortsShelf() {
  // Render in original order first (matches server output), then shuffle
  // client-side only after mount. Shuffling during the initial render would
  // make the server and client produce different random orders and trigger
  // a hydration mismatch error, so this two-step approach avoids that.
  const [items, setItems] = useState<Short[]>(shorts);

  useEffect(() => {
    const shuffled = [...shorts];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    setItems(shuffled);
  }, []);

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
          gap-3
          overflow-x-auto
          snap-x
          snap-mandatory
          pb-2
          scrollbar-hide-mobile

          sm:grid
          sm:grid-cols-4
          sm:gap-3

          md:grid-cols-6

          lg:grid-cols-7

          xl:grid-cols-8
        "
      >
        {items.map((short) => (
          <article
            key={short.id}
            className="
              group
              w-[130px]
              flex-shrink-0
              snap-start

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
            </div>

            {short.title && (
              <h3
                className="
                  mt-2
                  line-clamp-2
                  text-xs
                  font-semibold
                  text-white
                "
              >
                {short.title}
              </h3>
            )}

            <p
              className="
                mt-2
                text-[11px]
                font-medium
                text-orange-300
              "
            >
              {short.creator}
            </p>

            <p
              className="
                mt-0.5
                text-xs
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
