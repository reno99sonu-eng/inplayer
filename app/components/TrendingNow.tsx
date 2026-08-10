"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck } from "lucide-react";

import type { TrendingCreator } from "../data/trending";
import { formatViews } from "../lib/formatters";

const MIN_ITEMS_TO_LOOP = 6;
const AUTO_SCROLL_PIXELS_PER_SECOND = 30;
const FALLBACK_AVATAR = "/avatars/avatar.png";

function getAvatarSrc(avatarUrl: string | null | undefined) {
  const source = avatarUrl?.trim();

  if (!source) {
    return FALLBACK_AVATAR;
  }

  if (
    source.startsWith("/") ||
    source.startsWith("data:") ||
    source.startsWith("blob:") ||
    /^https?:\/\//i.test(source)
  ) {
    return source;
  }

  return `/${source}`;
}

export default function TrendingNow() {
  const [items, setItems] = useState<TrendingCreator[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadTrending = async () => {
      try {
        const res = await fetch("/api/trending", { signal: controller.signal });
        const data = await res.json();

        if (!controller.signal.aborted) {
          setItems(data.creators || []);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Failed to load trending:", error);

        if (!controller.signal.aborted) {
          setItems([]);
        }
      }
    };

    void loadTrending();

    return () => {
      controller.abort();
    };
  }, []);

  if (items !== null && items.length === 0) {
    return null;
  }

  // Create enough clones to ensure it fills the screen and loops seamlessly.
  // Using 4 groups ensures even on ultra-wide screens we have enough content.
  const realItems = items ?? [];
  const minItems = Math.max(1, Math.ceil(12 / (realItems.length || 1)));
  const baseSequence = Array.from({ length: minItems }, () => realItems).flat();
  // We need two identical halves for the CSS translateX(-50%) to work seamlessly
  const firstHalf = [...baseSequence, ...baseSequence];
  const secondHalf = [...baseSequence, ...baseSequence];
  const loopGroups = [firstHalf, secondHalf];

  return (
    <section className="mx-auto max-w-[1800px] px-3 py-1.5 lg:px-6 lg:py-2 overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes trendingMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-trending-marquee {
          animation: trendingMarquee 40s linear infinite;
        }
        .animate-trending-marquee:hover {
          animation-play-state: paused;
        }
      `}} />
      <div className="mb-1.5 flex items-end justify-between lg:mb-2">
        <div>
          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 lg:px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-red-300 light:text-red-600 backdrop-blur-sm">
            Trending now
          </span>

          <h2 className="mt-0.5 text-base lg:text-lg font-black tracking-tight text-white light:text-slate-900">
            Trending Creators
          </h2>
        </div>
      </div>

      <div className="relative">
        {items === null ? (
          <div className="flex gap-2 px-1 py-1 lg:gap-3 overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="flex w-20 flex-shrink-0 flex-col items-center gap-1 sm:w-22 lg:w-24"
              >
                <div className="h-14 w-14 animate-pulse rounded-full bg-white/[0.06] light:bg-black/5 sm:h-16 sm:w-16 lg:h-16 lg:w-16" />
                <div className="h-2 w-10 animate-pulse rounded-full bg-white/[0.06] light:bg-black/5" />
                <div className="h-1.5 w-6 animate-pulse rounded-full bg-white/[0.05] light:bg-black/5" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex w-max gap-2 lg:gap-3 py-1 animate-trending-marquee hover:[animation-play-state:paused]">
            {loopGroups.map((group, groupIndex) => (
              <div
                key={groupIndex}
                aria-hidden={groupIndex === 1}
                className="flex w-max gap-2 lg:gap-3"
              >
                {group.map((item, index) => (
                  <Link
                    key={`${groupIndex}-${index}-${item.userId}`}
                    href={`/u/${encodeURIComponent(item.username)}`}
                    tabIndex={groupIndex === 1 ? -1 : undefined}
                    aria-label={`Open ${item.name}'s channel`}
                    className="group flex w-20 flex-shrink-0 flex-col items-center gap-1 text-center sm:w-22 lg:w-24"
                    prefetch={false}
                  >
                    {/* Compact clean circular avatar with hover zoom */}
                    <div className="relative h-14 w-14 flex-shrink-0 transition duration-200 group-hover:scale-105 group-active:scale-95 sm:h-16 sm:w-16 lg:h-16 lg:w-16">
                      {/* eslint-disable-next-line @next/next/no-img-element -- creator avatars can be data URLs. */}
                      <img
                        src={getAvatarSrc(item.avatarUrl)}
                        alt=""
                        onError={(event) => {
                          if (!event.currentTarget.src.endsWith(FALLBACK_AVATAR)) {
                            event.currentTarget.src = FALLBACK_AVATAR;
                          }
                        }}
                        className="h-full w-full rounded-full object-cover"
                      />
                      {item.isVerified && (
                        <BadgeCheck
                          size={16}
                          className="absolute -bottom-0.5 -right-0.5 rounded-full fill-orange-400 text-[#101827] ring-2 ring-[#0b1220] light:ring-[#FBF6EA]"
                          aria-label="Verified creator"
                        />
                      )}
                    </div>
                    <p className="w-full truncate text-[11px] font-bold text-white light:text-slate-900">{item.name}</p>
                    <p className="w-full truncate text-[9.5px] font-medium text-slate-400 light:text-slate-600">{formatViews(item.windowViews)} views</p>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
