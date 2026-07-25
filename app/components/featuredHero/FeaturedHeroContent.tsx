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

        pt-4
        pb-4

        sm:pt-5
        sm:pb-5

        md:pt-6
        md:pb-6

        lg:justify-center
        lg:pt-0
        lg:pb-0
      "
    >
      {/* Badge */}

      <div
        className="
          mb-3
          inline-flex
          w-fit
          items-center
          rounded-full
          border
          border-orange-400/40
          bg-orange-500/10
          px-3
          py-1.5
          backdrop-blur-xl
        "
      >
        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />

        <span
          className="
            ml-2
            text-[9px]
            font-black
            uppercase
            tracking-[0.24em]
            text-orange-300
          "
        >
          🔥 WEEKLY FEATURED
        </span>
      </div>

      {/* Title — re-animates in on every slide change */}

      <h1
        key={slide.videoId}
        className="
          animate-hero-fade-up
          text-lg
          font-black
          leading-none
          tracking-[-0.03em]
          text-white

          sm:text-xl

          md:text-2xl

          lg:text-3xl
        "
      >
        {slide.title}
      </h1>

      {/* Creator */}

      <div
        key={`${slide.videoId}-creator`}
        className="animate-hero-fade-up mt-3 flex items-center gap-1.5"
      >
        <span className="text-sm font-semibold text-white">
        by {slide.uploaderName}
        </span>
      </div>

      {/* Stats */}

      <p
        key={`${slide.videoId}-stats`}
        className="animate-hero-fade-up mt-2 text-[11px] text-slate-300"
      >
        {formatViews(slide.windowViews)} this week
      </p>

      {/* Buttons */}

      <div className="mt-5">
        <FeaturedHeroButtons videoId={slide.videoId} />
      </div>
    </div>
  );
}
