"use client";

import { useEffect, useState } from "react";
import FeaturedHeroBackground from "./FeaturedHeroBackground";
import FeaturedHeroContent from "./FeaturedHeroContent";
import FeaturedHeroVideo from "./FeaturedHeroVideo";
import FeaturedHeroLayout from "./FeaturedHeroLayout";
import { featuredSlides } from "../../data/featuredSlides";

const SLIDE_DURATION = 4000;

export default function FeaturedHero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const timer = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % featuredSlides.length);
    }, SLIDE_DURATION);

    return () => clearTimeout(timer);
  }, [activeIndex, isPaused]);

  const activeSlide = featuredSlides[activeIndex];

  return (
    <section
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Featured content carousel"
      className="
        relative
        w-full
        overflow-hidden
        bg-black

        min-h-[210px]

        sm:min-h-[240px]

        md:min-h-[300px]

        lg:h-[38vh]

        xl:h-[42vh]

        2xl:h-[46vh]
      "
    >
      {/* Background */}
      <FeaturedHeroBackground />

      {/* Dark Overlay */}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#050816]/95 via-[#050816]/55 to-transparent" />

      {/* Responsive Layout */}
      <FeaturedHeroLayout>
        <FeaturedHeroContent slide={activeSlide} />
      </FeaturedHeroLayout>

      {/* Background Image — crossfading carousel */}
      <FeaturedHeroVideo slides={featuredSlides} activeIndex={activeIndex} />

      {/* Slide progress indicators */}
      <div
        className="
          absolute
          bottom-2.5
          left-1/2
          z-30
          flex
          -translate-x-1/2
          gap-1.5

          lg:bottom-6
          lg:gap-2
        "
      >
        {featuredSlides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => setActiveIndex(index)}
            aria-label={`Go to slide ${index + 1}`}
            className="
              relative
              h-1
              w-5

              lg:h-1.5
              lg:w-6
              overflow-hidden
              rounded-full
              bg-white/20
              transition-colors
              duration-300
              hover:bg-white/30
            "
          >
            {index === activeIndex && !isPaused && (
              <div
                key={`${slide.id}-fill`}
                className="absolute inset-y-0 left-0 rounded-full bg-orange-400"
                style={{
                  animation: `heroProgressFill ${SLIDE_DURATION}ms linear forwards`,
                }}
              />
            )}

            {index === activeIndex && isPaused && (
              <div className="absolute inset-y-0 left-0 w-full rounded-full bg-orange-400/50" />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
