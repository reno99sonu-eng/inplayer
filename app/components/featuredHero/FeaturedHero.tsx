"use client";

import { useEffect, useState } from "react";
import FeaturedHeroBackground from "./FeaturedHeroBackground";
import FeaturedHeroContent from "./FeaturedHeroContent";
import FeaturedHeroVideo from "./FeaturedHeroVideo";
import FeaturedHeroLayout from "./FeaturedHeroLayout";
import type { FeaturedSlide } from "../../data/featuredSlides";

const SLIDE_DURATION = 4000;

export default function FeaturedHero() {
  const [slides, setSlides] = useState<FeaturedSlide[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/featured-weekly");
        const data = await res.json();
        if (!cancelled) setSlides(data.videos || []);
      } catch (err) {
        console.error("Failed to load featured videos:", err);
        if (!cancelled) setSlides([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isPaused || !slides || slides.length <= 1) return;

    const timer = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, SLIDE_DURATION);

    return () => clearTimeout(timer);
  }, [activeIndex, isPaused, slides]);

  if (slides === null) {
    return (
      <section
        className="
          relative w-full overflow-hidden bg-black animate-pulse
          min-h-[190px] sm:min-h-[240px] md:min-h-[280px]
          lg:h-[32vh] xl:h-[34vh]
        "
      />
    );
  }

  if (slides.length === 0) return null;

  const activeSlide = slides[Math.min(activeIndex, slides.length - 1)];

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

        min-h-[190px]
        sm:min-h-[240px]
        md:min-h-[280px]
        lg:h-[32vh]
        xl:h-[34vh]
        2xl:h-[36vh]
      "
    >
      {/* Background */}
      <FeaturedHeroBackground />

      {/* Dark Overlay */}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#050816]/95 via-[#050816]/60 to-transparent" />

      {/* Responsive Layout */}
      <FeaturedHeroLayout>
        <FeaturedHeroContent slide={activeSlide} />
      </FeaturedHeroLayout>

      {/* Background Image — crossfading carousel */}
      <FeaturedHeroVideo slides={slides} activeIndex={activeIndex} />

      {/* Slide progress indicators — placed at bottom-right on mobile, centered on sm+ */}
      {slides.length > 1 && (
        <div
          className="
            absolute
            bottom-2
            right-3
            z-30
            flex
            gap-1.5

            sm:bottom-2.5
            sm:left-1/2
            sm:right-auto
            sm:-translate-x-1/2
            lg:bottom-3.5
          "
        >
          {slides.map((slide, index) => (
            <button
              key={slide.videoId}
              onClick={() => setActiveIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
              className="
                relative
                h-1
                w-4
                sm:w-5
                overflow-hidden
                rounded-full
                bg-white/20
                transition-colors
                duration-300
                hover:bg-white/40
              "
            >
              {index === activeIndex && !isPaused && (
                <div
                  key={`${slide.videoId}-fill`}
                  className="absolute inset-y-0 left-0 rounded-full bg-orange-400"
                  style={{
                    animation: `heroProgressFill ${SLIDE_DURATION}ms linear forwards`,
                  }}
                />
              )}

              {index === activeIndex && isPaused && (
                <div className="absolute inset-y-0 left-0 w-full rounded-full bg-orange-400/60" />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
