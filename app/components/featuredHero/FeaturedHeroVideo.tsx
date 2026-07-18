"use client";

import Image from "next/image";
import type { FeaturedSlide } from "../../data/featuredSlides";

interface FeaturedHeroVideoProps {
  slides: FeaturedSlide[];
  activeIndex: number;
}

export default function FeaturedHeroVideo({
  slides,
  activeIndex,
}: FeaturedHeroVideoProps) {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`
            absolute
            inset-0
            transition-opacity
            duration-1000
            ease-in-out
            ${index === activeIndex ? "opacity-100" : "opacity-0"}
          `}
        >
          <Image
            src={slide.image}
            alt={slide.title}
            fill
            priority={index === 0}
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: slide.objectPosition || "center" }}
          />
        </div>
      ))}

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
}
