"use client";

import { useEffect, useState } from "react";
import FeaturedHeroBackground from "./FeaturedHeroBackground";
import FeaturedHeroContent from "./FeaturedHeroContent";
import FeaturedHeroVideo from "./FeaturedHeroVideo";
import FeaturedHeroLayout from "./FeaturedHeroLayout";
import type { FeaturedSlide } from "../../data/featuredSlides";

const SLIDE_DURATION = 4000;

interface FeaturedHeroProps {
  // Fetched server-side in page.tsx (same data /api/featured-weekly
  // serves) and passed straight in, so the very first render already has
  // real slides instead of the black loading placeholder below. Optional
  // only so this component still works if ever rendered without a parent
  // providing it — in that case it falls back to the old client fetch.
  initialSlides?: FeaturedSlide[];
}

export default function FeaturedHero({ initialSlides }: FeaturedHeroProps) {
  const [slides, setSlides] = useState<FeaturedSlide[] | null>(
    initialSlides ?? null
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Already seeded server-side — no client fetch/black-placeholder needed.
    if (initialSlides) return;

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
  }, [initialSlides]);

  // Only worth auto-advancing when there's more than one real slide to
  // advance *to* — with exactly one, `(prev + 1) % 1` is always 0, so the
  // timer would just re-render the same slide forever for no reason.
  useEffect(() => {
    if (isPaused || !slides || slides.length <= 1) return;

    const timer = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, SLIDE_DURATION);

    return () => clearTimeout(timer);
  }, [activeIndex, isPaused, slides]);

  // Still loading — keep the section's footprint (avoids a layout jump)
  // but nothing to render inside yet.
  if (slides === null) {
    return (
      <section
        className="
          relative w-full overflow-hidden bg-black animate-pulse
          min-h-[220px] sm:min-h-[250px] md:min-h-[280px]
          lg:h-[34vh]
        "
      />
    );
  }

  // No real weekly data yet (fresh app, or the daily-views table isn't
  // provisioned) — omit the section entirely rather than show anything
  // fake in this much screen real estate.
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

        min-h-[220px]
        sm:min-h-[250px]
        md:min-h-[280px]
        lg:h-[34vh]
        xl:h-[36vh]
        2xl:h-[38vh]
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
      <FeaturedHeroVideo slides={slides} activeIndex={activeIndex} />

      {/* Slide progress indicators */}
      {slides.length > 1 && (
        <div
          className="
            absolute
            bottom-4
            left-1/2
            z-30
            flex
            -translate-x-1/2
            gap-2

            lg:bottom-6
          "
        >
          {slides.map((slide, index) => (
            <button
              key={slide.videoId}
              onClick={() => setActiveIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
              className="
                relative
                h-1.5
                w-6
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
                  key={`${slide.videoId}-fill`}
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
      )}
    </section>
  );
}
