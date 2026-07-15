"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { trending } from "../data/trending";

export default function TrendingNow() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const isUserInteractingRef = useRef(false);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastProgrammaticScrollRef = useRef(0);

  const items = [...trending, ...trending];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.style.scrollBehavior = "auto";

    const speed = 1.8;

    const step = () => {
      if (el && !isPausedRef.current && !isUserInteractingRef.current) {
        el.scrollLeft += speed;
        lastProgrammaticScrollRef.current = performance.now();

        const singleSetWidth = el.scrollWidth / 2;
        if (el.scrollLeft >= singleSetWidth) {
          el.scrollLeft -= singleSetWidth;
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    const handleScroll = () => {
      const now = performance.now();
      if (now - lastProgrammaticScrollRef.current > 50) {
        isUserInteractingRef.current = true;
        if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = setTimeout(() => {
          isUserInteractingRef.current = false;
        }, 1500);
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });

    // Mobile: a tap/touch on a card doesn't fire a scroll event, so
    // handle touchstart directly. Only listens for touchstart (never
    // touchend) so it can't get stuck if the matching end event is lost.
    const handleTouchStart = () => {
      isUserInteractingRef.current = true;
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = setTimeout(() => {
        isUserInteractingRef.current = false;
      }, 2000);
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
      el.removeEventListener("scroll", handleScroll);
      el.removeEventListener("touchstart", handleTouchStart);
    };
  }, []);

  const pause = () => {
    isPausedRef.current = true;
  };

  const resume = () => {
    isPausedRef.current = false;
  };

  return (
    <section className="relative mx-auto max-w-[1700px] px-5 pt-3 pb-2">
      <div className="pointer-events-none absolute inset-0">
        <h1
          className="
            absolute
            left-4
            top-4
            select-none
            text-[50px]
            font-black
            tracking-[-0.08em]
            text-white/[0.025]
            lg:left-8
            lg:top-1
            lg:text-[90px]
          "
        >
          TRENDING
        </h1>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-red-300 backdrop-blur-sm">
            Trending
          </span>
          <h2 className="mt-1 text-lg font-black text-white">
            Trending Now
          </h2>
        </div>

        <button className="hidden md:block rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition hover:border-orange-400 hover:text-orange-300">
          View All →
        </button>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-10 bg-gradient-to-r from-[#0b1220] to-transparent lg:w-16" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-10 bg-gradient-to-l from-[#0b1220] to-transparent lg:w-16" />

        <div
          ref={scrollRef}
          onMouseEnter={pause}
          onMouseLeave={resume}
          className="
            flex
            gap-5
            overflow-x-auto
            pt-3
            -mt-3
            pb-2
            pl-8
            lg:pl-10
            scrollbar-hide-mobile
          "
        >
          {items.map((item, index) => (
            <button
              key={`${item.id}-${index}`}
              className="
                group
                relative
                h-[230px]
                w-[190px]
                flex-shrink-0
                overflow-hidden
                rounded-[28px]
                border
                border-white/10
                bg-[#101827]
                shadow-[0_8px_24px_rgba(0,0,0,.35)]
                transition-all
                duration-300
                hover:-translate-y-1 hover:scale-[1.03]
                hover:border-orange-400/40
                hover:shadow-[0_0_50px_rgba(249,115,22,.22)]
              "
            >
              <Image
                src={item.thumbnail}
                alt={item.title}
                fill
                className="object-cover object-top transition duration-500 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

              <div className="absolute bottom-0 w-full p-4">
                <h3 className="text-base font-black text-white">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs text-slate-300">{item.creator}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
