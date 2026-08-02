"use client";

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
      {slides.map((slide, index) => {
        const url = String(slide.thumbnailUrl || "");
        const isVideo = url.startsWith("data:video/") || url.endsWith(".mp4") || url.endsWith(".webm");
        return (
          <div
            key={slide.videoId || index}
            className={`
              absolute
              inset-0
              transition-opacity
              duration-1000
              ease-in-out
              ${index === activeIndex ? "opacity-100" : "opacity-0"}
            `}
          >
            {url && (
              isVideo ? (
                <video src={url} autoPlay loop muted playsInline className="h-full w-full object-cover" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={url} alt={slide.title} className="h-full w-full object-cover" />
              )
            )}
          </div>
        );
      })}

      {/* Subtle Dark Overlay */}
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
}
