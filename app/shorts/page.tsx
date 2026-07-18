"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
} from "lucide-react";

import { shorts } from "../data/shorts";

export default function ShortsPage() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
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

  const toggleLike = (id: number) => {
    setLiked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSave = (id: number) => {
    setSaved((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div
      className="
        relative
        h-[calc(100dvh-5rem)]
        w-full
        overflow-hidden
        bg-[#06101D]

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
          from-[#06101D]/85
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
            hover:border-orange-400/40
            hover:bg-orange-500/10
          "
        >
          <ArrowLeft size={18} />
        </button>

        <h1 className="text-base font-black text-white">Shorts</h1>

        <button
          onClick={() => setMuted(!muted)}
          className="
            ml-auto
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
            hover:border-orange-400/40
            hover:bg-orange-500/10
          "
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      {/* Progress dots — a home-grown position indicator, not a YouTube pattern */}
      <div
        className="
          pointer-events-none
          absolute
          right-2
          top-1/2
          z-20
          hidden
          -translate-y-1/2
          flex-col
          gap-1.5

          sm:flex
        "
      >
        {shorts.map((_, index) => (
          <span
            key={index}
            className={`
              h-1.5
              w-1.5
              rounded-full
              transition-all
              duration-300
              ${
                activeIndex === index
                  ? "scale-125 bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,.8)]"
                  : "bg-white/25"
              }
            `}
          />
        ))}
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

              {activeIndex === index && (
                <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_rgba(249,115,22,.15)]" />
              )}

              <div className="absolute bottom-6 left-4 right-16">
                {short.title && (
                  <h2 className="text-base font-black leading-tight text-white">
                    {short.title}
                  </h2>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <div className="relative h-8 w-8 overflow-hidden rounded-full ring-2 ring-orange-400/40">
                    <Image
                      src="/avatars/avatar.png"
                      alt={short.creator}
                      fill
                      sizes="32px"
                      className="object-cover"
                    />
                  </div>

                  <span className="text-sm font-semibold text-orange-300">
                    {short.creator}
                  </span>

                  <button
                    className="
                      ml-1
                      rounded-full
                      bg-gradient-to-r
                      from-orange-500
                      to-amber-400
                      px-3
                      py-1
                      text-[11px]
                      font-bold
                      text-white
                      transition
                      hover:scale-105
                    "
                  >
                    Subscribe
                  </button>
                </div>

                <p className="mt-1 text-[11px] text-slate-300">
                  {short.views}
                </p>
              </div>

              {/* Icon rail */}
              <div className="absolute bottom-6 right-3 flex flex-col items-center gap-4">
                <button
                  onClick={() => toggleLike(short.id)}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className={`
                      flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-full
                      backdrop-blur-md
                      transition-all
                      duration-200
                      ${
                        liked[short.id]
                          ? "bg-orange-500/20"
                          : "bg-white/10 hover:bg-white/20"
                      }
                    `}
                  >
                    <Heart
                      size={20}
                      className={
                        liked[short.id]
                          ? "fill-orange-400 text-orange-400"
                          : "text-white"
                      }
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-white">
                    {liked[short.id] ? "Liked" : "Like"}
                  </span>
                </button>

                <button className="flex flex-col items-center gap-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-all duration-200 hover:bg-white/20">
                    <MessageCircle size={20} className="text-white" />
                  </div>
                  <span className="text-[10px] font-semibold text-white">
                    Comment
                  </span>
                </button>

                <button className="flex flex-col items-center gap-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-all duration-200 hover:bg-white/20">
                    <Share2 size={20} className="text-white" />
                  </div>
                  <span className="text-[10px] font-semibold text-white">
                    Share
                  </span>
                </button>

                <button
                  onClick={() => toggleSave(short.id)}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className={`
                      flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-full
                      backdrop-blur-md
                      transition-all
                      duration-200
                      ${
                        saved[short.id]
                          ? "bg-orange-500/20"
                          : "bg-white/10 hover:bg-white/20"
                      }
                    `}
                  >
                    <Bookmark
                      size={20}
                      className={
                        saved[short.id]
                          ? "fill-orange-400 text-orange-400"
                          : "text-white"
                      }
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-white">
                    Save
                  </span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
