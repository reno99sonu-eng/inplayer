"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { MoreVertical, ChevronDown } from "lucide-react";
import { recommendations, type Recommendation } from "../data/recommendations";
import { shorts, type Short } from "../data/shorts";
import ShortsShelf from "./ShortsShelf";

export default function RecommendationFeed() {
  // Render in original order first (matches server output), then shuffle
  // client-side only after mount. Shuffling during the initial render would
  // make the server and client produce different random orders and trigger
  // a hydration mismatch error, so this two-step approach avoids that.
  const [items, setItems] = useState<Recommendation[]>(recommendations);
  const [shuffledShorts, setShuffledShorts] = useState<Short[]>(shorts);

  useEffect(() => {
    const shuffledRecs = [...recommendations];
    for (let i = shuffledRecs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledRecs[i], shuffledRecs[j]] = [shuffledRecs[j], shuffledRecs[i]];
    }
    setItems(shuffledRecs);

    const shuffledShortsArr = [...shorts];
    for (let i = shuffledShortsArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledShortsArr[i], shuffledShortsArr[j]] = [
        shuffledShortsArr[j],
        shuffledShortsArr[i],
      ];
    }
    setShuffledShorts(shuffledShortsArr);
  }, []);

  // Recommendations split into three batches: two rows worth, then two more
  // rows worth, then everything else
  const firstVideos = items.slice(0, 10);
  const secondVideos = items.slice(10, 20);
  const remainingVideos = items.slice(20);

  // Shorts split across the two placements: a single compact row first,
  // then the rest in the full grid further down
  const shortsRowOne = shuffledShorts.slice(0, 8);
  const shortsRowTwo = shuffledShorts.slice(8);

  const renderCard = (video: Recommendation) => (
    <article
      key={video.id}
      className="
        group
        transition-all
        duration-300
      "
    >
      {/* Thumbnail */}
      <div
        className="
          relative
          aspect-video
          overflow-hidden
          rounded-2xl
          bg-[#111827]
        "
      >
        <Image
          src={video.thumbnail}
          alt={video.title}
          fill
          sizes="(max-width:768px)100vw,(max-width:1280px)50vw,25vw"
          className="
            object-cover
            transition-transform
            duration-500
            group-hover:scale-[1.05]
          "
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

        <span
          className="
            absolute
            bottom-3
            right-3
            rounded-md
            bg-black/85
            px-2
            py-1
            text-xs
            font-semibold
            text-white
            backdrop-blur-sm
          "
        >
          {video.duration}
        </span>
      </div>

      {/* Information */}
      <div className="mt-4 flex items-start gap-3">

        <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-white/10">
          <Image
            src={video.avatar}
            alt={video.creator}
            fill
            sizes="44px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">

          <h3
            className="
              line-clamp-2
              text-[16px]
              font-semibold
              leading-6
              text-white
            "
          >
            {video.title}
          </h3>

          <div className="mt-2 flex items-center gap-1 text-sm text-slate-400">
            <span className="truncate">
              {video.creator}
            </span>

            {video.verified && (
              <span className="ml-1 text-xs font-bold text-slate-300">
                ✓
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-slate-500">
            {video.views} • {video.uploaded}
          </p>

        </div>

        <button
          className="
            flex
            h-9
            w-9
            flex-shrink-0
            items-center
            justify-center
            rounded-full
            text-slate-400
            transition-colors
            hover:bg-white/5
            hover:text-white
          "
        >
          <MoreVertical size={18} />
        </button>

      </div>
    </article>
  );

  return (
    <>
      {/* First batch of recommendations */}
      <section className="mx-auto max-w-[1800px] px-4 py-5 lg:py-10 lg:px-8">
        <div
          className="
            grid
            grid-cols-1
            gap-x-6
            gap-y-10

            sm:grid-cols-2
            lg:grid-cols-3
            xl:grid-cols-4
            2xl:grid-cols-5
          "
        >
          {firstVideos.map(renderCard)}
        </div>
      </section>

      {/* Shorts — first row */}
      <ShortsShelf items={shortsRowOne} />

      {/* Second batch of recommendations */}
      <section className="mx-auto max-w-[1800px] px-4 py-3 lg:py-6 lg:px-8">
        <div
          className="
            grid
            grid-cols-1
            gap-x-6
            gap-y-10

            sm:grid-cols-2
            lg:grid-cols-3
            xl:grid-cols-4
            2xl:grid-cols-5
          "
        >
          {secondVideos.map(renderCard)}
        </div>
      </section>

      {/* Shorts — second row */}
      <ShortsShelf items={shortsRowTwo} />

      {/* Remaining Recommendations */}
      <section className="mx-auto max-w-[1800px] px-4 pb-4 lg:px-8">
        <div
          className="
            grid
            grid-cols-1
            gap-x-6
            gap-y-10

            sm:grid-cols-2
            lg:grid-cols-3
            xl:grid-cols-4
            2xl:grid-cols-5
          "
        >
          {remainingVideos.map(renderCard)}
        </div>

        {/* Mobile Only Show More */}
        <div className="mt-6 mb-4 flex justify-center lg:hidden">
          <button
            className="
              group
              relative
              overflow-hidden
              rounded-full
              border
              border-orange-400/30
              bg-gradient-to-r
              from-[#111827]
              via-[#182234]
              to-[#111827]
              px-7
              py-3.5
              text-white
              shadow-[0_0_30px_rgba(249,115,22,.12)]
              transition-all
              duration-300
              active:scale-95
            "
          >
            {/* Animated Glow */}
            <span
              className="
                absolute
                inset-0
                opacity-0
                bg-gradient-to-r
                from-orange-500/10
                via-yellow-300/10
                to-orange-500/10
                transition-opacity
                duration-300
                group-hover:opacity-100
              "
            />

            <span className="relative flex items-center gap-2">
              <span className="font-semibold tracking-wide">
                Show More
              </span>

              <ChevronDown
                size={18}
                className="
                  transition-transform
                  duration-300
                  group-hover:translate-y-1
                "
              />
            </span>
          </button>
        </div>

      </section>
    </>
  );
}
