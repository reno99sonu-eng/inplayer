"use client";

import FeaturedHeroButtons from "./FeaturedHeroButtons";
import type { FeaturedSlide } from "../../data/featuredSlides";
import { formatViews } from "../../lib/formatters";

interface FeaturedHeroContentProps {
  slide: FeaturedSlide;
}

export default function FeaturedHeroContent({
  slide,
}: FeaturedHeroContentProps) {
  return (
    <div
      className="
        relative
        z-20
        flex
        w-full
        max-w-[560px]
        flex-col
        justify-end
        items-start
        text-left

        pt-1
        pb-1

        lg:justify-end
        lg:pt-0
        lg:pb-0
      "
    >
      {/* Sleek Compact Badge */}
      <div
        className="
          mb-1
          inline-flex
          w-fit
          items-center
          rounded-full
          border
          border-orange-400/40
          bg-orange-500/10
          px-2
          py-0.5
          backdrop-blur-xl
        "
      >
        <span className="h-1 w-1 rounded-full bg-orange-400 animate-pulse" />
        <span
          className="
            ml-1
            text-[8px]
            sm:text-[9px]
            font-black
            uppercase
            tracking-[0.18em]
            text-orange-300
          "
        >
          🔥 WEEKLY FEATURED
        </span>
      </div>

      {/* Title */}
      <h1
        key={slide.videoId}
        className="
          animate-hero-fade-up
          text-sm
          font-black
          leading-tight
          tracking-[-0.02em]
          text-white
          line-clamp-1

          sm:text-base

          md:text-xl

          lg:text-2xl
        "
      >
        {slide.title}
      </h1>

      {/* Creator & Stats in a single compact row */}
      <div
        key={`${slide.videoId}-meta`}
        className="animate-hero-fade-up mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs text-slate-300"
      >
        <span className="font-bold text-white truncate max-w-[200px] sm:max-w-none">
          by {slide.uploaderName}
        </span>
        <span className="text-orange-400/80 font-bold">•</span>
        <span className="text-slate-300">
          {formatViews(slide.windowViews)} this week
        </span>
      </div>

      {/* Buttons */}
      <div className="mt-1.5 sm:mt-3">
        <FeaturedHeroButtons videoId={slide.videoId} uploaderUsername={slide.uploaderUsername} />
      </div>
    </div>
  );
}
