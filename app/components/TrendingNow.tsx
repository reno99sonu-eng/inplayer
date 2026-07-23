"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { TrendingItem } from "../data/trending";
import { formatViews } from "../lib/formatters";

// Below this many real videos, the seamless "duplicate the list and loop"
// marquee trick (see the scroll effect below) looks broken rather than
// smooth — a 2-3 card row endlessly re-cycling reads as a glitch, not an
// animation. Under the threshold this just renders a plain, static,
// manually-scrollable row instead.
const MIN_ITEMS_TO_LOOP = 6;

export default function TrendingNow() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const isUserInteractingRef = useRef(false);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastProgrammaticScrollRef = useRef(0);

  const [items, setItems] = useState<TrendingItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/trending");
        const data = await res.json();
        if (!cancelled) setItems(data.videos || []);
      } catch (err) {
        console.error("Failed to load trending videos:", err);
        if (!cancelled) setItems([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const canLoop = (items?.length || 0) >= MIN_ITEMS_TO_LOOP;
  const displayItems = items ? (canLoop ? [...items, ...items] : items) : [];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !canLoop) return;

    el.style.scrollBehavior = "auto";

    const speed = 1.1;

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
  }, [canLoop, items]);

  const pause = () => {
    isPausedRef.current = true;
  };

  const resume = () => {
    isPausedRef.current = false;
  };

  // Real data hasn't loaded (or come back empty) yet — nothing to show.
  // No placeholder cards, no dummy fallback; the section just doesn't
  // render rather than show something fake while real videos catch up.
  if (items !== null && items.length === 0) return null;

  return (
    <section className="relative mx-auto max-w-[1700px] px-4 lg:px-5 pt-2 lg:pt-3 pb-1.5 lg:pb-2">
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
            light:text-black/[0.025]
            lg:left-8
            lg:top-1
            lg:text-[90px]
          "
        >
          TRENDING
        </h1>
      </div>

      <div className="mb-2 lg:mb-3 flex items-center justify-between">
        <div>
          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 lg:px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-red-300 light:text-red-600 backdrop-blur-sm">
            Trending
          </span>
          <h2 className="mt-1 text-lg font-black text-white light:text-slate-900">
            Trending Now
          </h2>
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-10 bg-gradient-to-r from-[#0b1220] light:from-[#FBF6EA] to-transparent lg:w-16" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-10 bg-gradient-to-l from-[#0b1220] light:from-[#FBF6EA] to-transparent lg:w-16" />

        <div
          ref={scrollRef}
          onMouseEnter={pause}
          onMouseLeave={resume}
          className="
            flex
            gap-3
            lg:gap-5
            overflow-x-auto
            pt-2
            -mt-2
            lg:pt-3
            lg:-mt-3
            pb-1.5
            lg:pb-2
            pl-5
            lg:pl-10
            scrollbar-hide-mobile
          "
        >
          {items === null
            ? // Loading — same card footprint, no numbers/labels yet, so
              // the row doesn't jump around once real data arrives.
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="
                    h-[190px]
                    w-[155px]
                    lg:h-[230px]
                    lg:w-[190px]
                    flex-shrink-0
                    animate-pulse
                    rounded-[28px]
                    border
                    border-white/10
                    bg-white/[0.03]
                  "
                />
              ))
            : displayItems.map((item, index) => (
                <Link
                  key={`${item.videoId}-${index}`}
                  href={`/watch/${item.videoId}`}
                  className="
                    group
                    relative
                    h-[190px]
                    w-[155px]
                    lg:h-[230px]
                    lg:w-[190px]
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
                    src={item.thumbnail || "/avatars/avatar.png"}
                    alt={item.title}
                    fill
                    className="object-cover object-top transition duration-500 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                  <div className="absolute bottom-0 w-full p-3 lg:p-4">
                    <h3 className="line-clamp-2 text-base font-black text-white">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-300">
                      {item.creator}
                    </p>
                    <p className="mt-0.5 text-[11px] text-orange-300">
                      {formatViews(item.views)} today
                    </p>
                  </div>
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
}
