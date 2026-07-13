"use client";

import Image from "next/image";

export default function FeaturedHeroVideo() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden">

      <Image
        src="/hero/desktop/featured-v2.jpg"
        alt="Featured Hero"
        fill
        priority
        className="object-cover"
      />

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/35" />

    </div>
  );
}