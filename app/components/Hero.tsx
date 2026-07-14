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
        min-h-[42vh]
        md:min-h-[48vh]
        lg:min-h-[50vh]
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
          gap-6
          px-5
          py-6
          md:py-8
          lg:grid-cols-2
          lg:px-8
          lg:py-10
        "
      >
        <HeroContent />

        <HeroMedia />
      </div>
    </section>
  );
}