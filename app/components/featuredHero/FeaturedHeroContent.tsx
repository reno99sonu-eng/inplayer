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

        pt-2
        pb-2

        lg:justify-center
        lg:pt-0
        lg:pb-0
      "
    >
      {/* Badge */}
      <div
        className="
          mb-1.5
          inline-flex
          w-fit
          items-center
          rounded-full
          border
          border-orange-400/40
          bg-orange-500/10
          px-2.5
          py-1
          backdrop-blur-xl
        "
      >
        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
        <span
          className="
            ml-1.5
            text-[9px]
            font-black
            uppercase
            tracking-[0.2em]
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
          text-base
          font-black
          leading-tight
          tracking-[-0.02em]
          text-white
          line-clamp-1

          sm:text-lg

          md:text-xl

          lg:text-2xl
        "
      >
        {slide.title}
      </h1>

      {/* Creator & Stats in a single compact row */}
      <div
        key={`${slide.videoId}-meta`}
        className="animate-hero-fade-up mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-300"
      >
        <span className="font-bold text-white truncate max-w-[240px] sm:max-w-none">
          by {slide.uploaderName}
        </span>
        <span className="text-orange-400/70 font-black">•</span>
        <span className="text-slate-300 text-[11px] sm:text-xs">
          {formatViews(slide.windowViews)} views this week
        </span>
      </div>

      {/* Buttons */}
      <div className="mt-2.5 sm:mt-3">
        <FeaturedHeroButtons videoId={slide.videoId} uploaderUsername={slide.uploaderUsername} />
      </div>
    </div>
  );
}
