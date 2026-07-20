"use client";

import FeaturedHeroButtons from "./FeaturedHeroButtons";
import type { FeaturedSlide } from "../../data/featuredSlides";

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

        pt-3
        pb-3

        sm:pt-4
        sm:pb-4

        md:pt-5
        md:pb-5

        lg:justify-center
        lg:pt-0
        lg:pb-0
      "
    >
      {/* Badge */}

      <div
        className="
          mb-2
          lg:mb-3
          inline-flex
          w-fit
          items-center
          rounded-full
          border
          border-orange-400/40
          bg-orange-500/10
          px-2.5
          py-1
          lg:px-3
          lg:py-1.5
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
        key={slide.id}
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
        key={`${slide.id}-creator`}
        className="animate-hero-fade-up mt-2 lg:mt-3 flex items-center gap-1.5"
      >
        <span className="text-sm font-semibold text-white">
          by {slide.isHandle && "@"}
          {slide.creator}
        </span>

        {slide.verified && (
          <span className="text-xs font-medium text-emerald-400">✓</span>
        )}
      </div>

      {/* Stats */}

      <p
        key={`${slide.id}-stats`}
        className="animate-hero-fade-up mt-1.5 lg:mt-2 text-[11px] text-slate-300"
      >
        {slide.views} <span className="text-orange-400">•</span>{" "}
        {slide.duration}
      </p>

      {/* Buttons */}

      <div className="mt-3 lg:mt-5">
        <FeaturedHeroButtons />
      </div>
    </div>
  );
}
