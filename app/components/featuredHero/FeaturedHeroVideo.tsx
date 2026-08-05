"use client";

import Image from "next/image";
import type { FeaturedSlide } from "../../data/featuredSlides";

interface FeaturedHeroVideoProps {
  slides: FeaturedSlide[];
  activeIndex: number;
}

// Foreground thumbnails use object-contain, NOT object-cover — the same fix
// already applied to FeaturedHeroAd.tsx's admin-uploaded poster, for the
// same reason. This box's own aspect ratio isn't fixed (a short, nearly
// square shape on mobile up to a wide 38vh-tall strip on large desktops),
// and real video thumbnails get uploaded at all kinds of aspect ratios, not
// just 16:9. object-cover was cropping straight into the center of each
// thumbnail — on a mobile-shaped box that can crop out the actual subject
// entirely, sometimes landing on a dark/plain patch of the source image and
// reading as "the poster is just a black box." A blurred, scaled-up copy of
// the same image fills the letterbox space behind it so there's never an
// empty gap, while the sharp foreground copy always shows the whole,
// uncropped thumbnail.
export default function FeaturedHeroVideo({
  slides,
  activeIndex,
}: FeaturedHeroVideoProps) {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black">
      {slides.map((slide, index) => (
        <div
          key={slide.videoId}
          className={`
            absolute
            inset-0
            transition-opacity
            duration-1000
            ease-in-out
            ${index === activeIndex ? "opacity-100" : "opacity-0"}
          `}
        >
          {slide.thumbnailUrl && (
            <>
              {/* Blurred, scaled-up backdrop copy — decorative duplicate of
                  the real image below, which already carries the alt text. */}
              <Image
                src={slide.thumbnailUrl}
                alt=""
                aria-hidden="true"
                fill
                priority={index === 0}
                sizes="100vw"
                className="scale-110 object-cover opacity-50 blur-2xl"
              />
              <Image
                src={slide.thumbnailUrl}
                alt={slide.title}
                fill
                priority={index === 0}
                sizes="100vw"
                className="object-contain"
              />
            </>
          )}
        </div>
      ))}

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/35" />
    </div>
  );
}
