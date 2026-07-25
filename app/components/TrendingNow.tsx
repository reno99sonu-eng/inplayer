"use client";

import Image from "next/image";
import Link from "next/link";
import Marquee from "react-fast-marquee";
import { useEffect,useState } from "react";

import type { TrendingItem } from "../data/trending";
import { formatViews } from "../lib/formatters";

const MIN_ITEMS_TO_LOOP = 6;

export default function TrendingNow() {

  const [items, setItems] = useState<TrendingItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/trending");

        const data = await res.json();

        if (!cancelled) {
          setItems(data.videos || []);
        }
      } catch (error) {
        console.error("Failed to load trending:", error);

        if (!cancelled) {
          setItems([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const realItems = items ?? [];

  const marqueeItems = items ?? [];
  
  
    if (items !== null && items.length === 0) {
      return null;
    }
  
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

        <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-10 bg-gradient-to-r from-[#0b1220] light:from-[#FBF6EA] to-transparent lg:w-16" />

        <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-10 bg-gradient-to-l from-[#0b1220] light:from-[#FBF6EA] to-transparent lg:w-16" />

        {items === null ? (
          <div
            className="
              flex
              gap-3
              lg:gap-5
              pl-5
              lg:pl-10
              pt-2
              lg:pt-3
              pb-2
            "
          >
            {Array.from({ length: 6 }).map((_, i) => (
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
            ))}
          </div>
        ) : (
          <Marquee
          pauseOnHover
          autoFill
          speed={25}
          gradient={false}
        >
          <div
            className="
              flex
              gap-3
              lg:gap-5
              py-2
              lg:py-3
              pr-5
              lg:pr-5
            "
          >
              {marqueeItems.map((item, index) => (
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
                    hover:-translate-y-1
                    hover:scale-[1.03]
                    hover:border-orange-400/40
                    hover:shadow-[0_0_50px_rgba(249,115,22,.22)]
                  "
                >
                  <Image
                    src={item.thumbnailUrl || "/avatars/avatar.png"}
                    alt={item.title}
                    fill
                    className="
                      object-cover
                      object-top
                      transition
                      duration-500
                      group-hover:scale-105
                    "
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                  <div className="absolute bottom-0 w-full p-3 lg:p-4">
                    <h3 className="line-clamp-2 text-base font-black text-white">
                      {item.title}
                    </h3>

                    <p className="mt-1 text-xs text-slate-300">
                      {item.uploaderName}
                    </p>

                    <p className="mt-0.5 text-[11px] text-orange-300">
                      {formatViews(item.windowViews)} today
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </Marquee>
        )}
      </div>
    </section>
  );
}