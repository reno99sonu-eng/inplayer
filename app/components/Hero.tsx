"use client";

import HeroBackground from "./HeroBackground";
import HeroContent from "./HeroContent";
import HeroMedia from "./HeroMedia";

export default function Hero() {
  return (
    <section
      id="hero"
      className="
        relative
        overflow-hidden
        bg-[#030712]
        min-h-[72vh]
        lg:min-h-[78vh]
      "
    >
      <HeroBackground />

      <div
        className="
          relative
          z-10
          mx-auto
          max-w-[1500px]
          grid
          items-center
          gap-10
          px-5
          py-12
          md:py-16
          lg:grid-cols-2
          lg:px-8
          lg:py-20
        "
      >
        <HeroContent />

        <HeroMedia />
      </div>
    </section>
  );
}