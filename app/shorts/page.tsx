"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { shorts } from "../data/shorts";

export default function ShortsPage() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const index = slideRefs.current.findIndex(
              (el) => el === entry.target
            );
            if (index !== -1) setActiveIndex(index);
          }
        });
      },
      { threshold: [0.6] }
    );

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="
        relative
        h-[calc(100dvh-5rem)]
        w-full
        overflow-hidden
        bg-black

        lg:h-dvh
      "
    >
      {/* Pinned header, stays on screen while the feed scrolls underneath */}
      <div
        className="
          absolute
          top-0
          left-0
          right-0
          z-20
          flex
          items-center
          gap-3
          bg-gradient-to-b
          from-black/70
          to-transparent
          px-4
          py-4
        "
      >
        <button
          onClick={() => router.back()}
          className="
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-full
            border
            border-white/10
            bg-white/10
            text-white
            backdrop-blur-md
            transition-all
            duration-200
            hover:bg-white/20
          "
        >
          <ArrowLeft size={18} />
        </button>

        <h1 className="text-base font-black text-white">Shorts</h1>
      </div>

      {/* Vertical swipeable feed. Scroll-snap gives native swipe-up/down
          behavior on mobile without needing custom touch-gesture code. */}
      <div
        className="
          mx-auto
          h-full
          w-full
          max-w-[480px]
          snap-y
          snap-mandatory
          overflow-y-scroll
          scroll-smooth
          lg:border-x
          lg:border-white/10
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {shorts.map((short, index) => (
          <div
            key={short.id}
            ref={(el) => {
              slideRefs.current[index] = el;
            }}
            className="
              relative
              flex
              h-full
              w-full
              snap-start
              snap-always
              items-center
              justify-center
            "
          >
            <div
              className={`
                relative
                h-full
                w-full
                transition-all
                duration-500
                ease-out
                ${
                  activeIndex === index
                    ? "scale-100 opacity-100"
                    : "scale-[0.94] opacity-60"
                }
              `}
            >
              <Image
                src={short.poster}
                alt={short.title || "InPlay short"}
                fill
                sizes="100vw"
                priority={index === 0}
                className="object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />

              <div className="absolute bottom-6 left-4 right-4">
                {short.title && (
                  <h2 className="text-base font-black leading-tight text-white">
                    {short.title}
                  </h2>
                )}

                <p className="mt-1 text-xs font-semibold text-orange-300">
                  {short.creator}
                </p>

                <p className="mt-0.5 text-[11px] text-slate-300">
                  {short.views}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
