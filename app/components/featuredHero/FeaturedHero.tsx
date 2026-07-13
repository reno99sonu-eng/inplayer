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

        min-h-[620px]

        sm:min-h-[700px]

        md:min-h-[760px]

        lg:h-[82vh]

        xl:h-[88vh]

        2xl:h-screen
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
      <div className="hidden lg:block">
      </div>

      {/* Background Image / Video */}
      <FeaturedHeroVideo />
    </section>
  );
}