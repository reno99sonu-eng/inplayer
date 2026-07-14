"use client";

import FeaturedHeroBackground from "./FeaturedHeroBackground";
import FeaturedHeroContent from "./FeaturedHeroContent";
import FeaturedHeroVideo from "./FeaturedHeroVideo";
import FeaturedHeroLayout from "./FeaturedHeroLayout";

export default function FeaturedHero() {
  return (
    <section
      className="
        relative
        w-full
        overflow-hidden
        bg-black

        min-h-[340px]

        sm:min-h-[400px]

        md:min-h-[460px]

        lg:h-[50vh]

        xl:h-[55vh]

        2xl:h-[60vh]
      "
    >
      {/* Background */}
      <FeaturedHeroBackground />

      {/* Dark Overlay */}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#050816]/95 via-[#050816]/55 to-transparent" />

      {/* Responsive Layout */}
      <FeaturedHeroLayout>
        <FeaturedHeroContent />
      </FeaturedHeroLayout>

      {/* Desktop Only Stats */}
      <div className="hidden lg:block" />

      {/* Background Image / Video */}
      <FeaturedHeroVideo />
    </section>
  );
}