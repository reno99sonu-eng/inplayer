"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Flame } from "lucide-react";

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
  const [loopRepeats, setLoopRepeats] = useState(1);
  const carouselRef = useRef<HTMLDivElement>(null);
  const firstGroupRef = useRef<HTMLDivElement>(null);
  const secondGroupRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const sequenceWidthRef = useRef(0);
  const isHoveringRef = useRef(false);
  const isDraggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const clickResetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadTrending = async () => {
      try {
        const res = await fetch("/api/trending", { signal: controller.signal });
        const data = await res.json();

        if (!controller.signal.aborted) {
          setItems(data.creators || []);
          setLoopRepeats(1);
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

  const realItems = items ?? [];
  const minimumLoopItems =
    realItems.length === 0
      ? []
      : Array.from(
          {
            length: Math.max(
              1,
              Math.ceil(MIN_ITEMS_TO_LOOP / realItems.length),
            ),
          },
          () => realItems,
        ).flat();
  const loopItems = Array.from(
    { length: loopRepeats },
    () => minimumLoopItems,
  ).flat();

  useEffect(() => {
    const carousel = carouselRef.current;
    const firstGroup = firstGroupRef.current;
    const secondGroup = secondGroupRef.current;

    if (!carousel || !firstGroup || !secondGroup || loopItems.length === 0) {
      sequenceWidthRef.current = 0;
      return;
    }

    const measure = () => {
      const sequenceWidth = secondGroup.offsetLeft - firstGroup.offsetLeft;

      if (sequenceWidth <= 0) {
        return;
      }

      sequenceWidthRef.current = sequenceWidth;

      const baseSequenceWidth = sequenceWidth / loopRepeats;
      const requiredRepeats = Math.max(
        1,
        Math.ceil(carousel.clientWidth / baseSequenceWidth) + 1,
      );

      if (requiredRepeats > loopRepeats) {
        setLoopRepeats(requiredRepeats);
        return;
      }

      if (carousel.scrollLeft >= sequenceWidth) {
        carousel.scrollLeft %= sequenceWidth;
      }
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(carousel);

    return () => {
      resizeObserver.disconnect();
    };
  }, [loopItems.length, loopRepeats]);

  useEffect(() => {
    const carousel = carouselRef.current;

    if (!carousel || loopItems.length === 0) {
      return;
    }

    const animate = (timestamp: number) => {
      const previousTimestamp = lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;

      const shouldScroll =
        !isHoveringRef.current &&
        !isDraggingRef.current &&
        document.visibilityState === "visible" &&
        sequenceWidthRef.current > 0;

      if (shouldScroll && previousTimestamp !== null) {
        const elapsed = Math.min(timestamp - previousTimestamp, 50);
        const sequenceWidth = sequenceWidthRef.current;
        const nextScrollLeft =
          carousel.scrollLeft +
          (elapsed * AUTO_SCROLL_PIXELS_PER_SECOND) / 1000;

        carousel.scrollLeft =
          nextScrollLeft >= sequenceWidth
            ? nextScrollLeft - sequenceWidth
            : nextScrollLeft;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      lastFrameTimeRef.current = null;
    };
  }, [loopItems.length]);

  useEffect(() => {
    return () => {
      if (clickResetTimeoutRef.current !== null) {
        window.clearTimeout(clickResetTimeoutRef.current);
      }
    };
  }, []);

  const normalizeScrollPosition = (scrollLeft: number) => {
    const sequenceWidth = sequenceWidthRef.current;

    if (sequenceWidth <= 0) {
      return Math.max(0, scrollLeft);
    }

    const normalized = scrollLeft % sequenceWidth;
    return normalized < 0 ? normalized + sequenceWidth : normalized;
  };

  const endDrag = (pointerId?: number) => {
    if (pointerId !== undefined && activePointerIdRef.current !== pointerId) {
      return;
    }

    isDraggingRef.current = false;
    activePointerIdRef.current = null;

    if (clickResetTimeoutRef.current !== null) {
      window.clearTimeout(clickResetTimeoutRef.current);
    }

    clickResetTimeoutRef.current = window.setTimeout(() => {
      hasDraggedRef.current = false;
      clickResetTimeoutRef.current = null;
    }, 0);
  };

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
            Trending today
          </span>

          <h2 className="mt-1 text-lg font-black text-white light:text-slate-900">
            Trending Creators
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
                  h-[214px]
                  w-[174px]
                  lg:h-[250px]
                  lg:w-[210px]
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
          <div
            ref={carouselRef}
            className="cursor-grab touch-pan-y select-none overflow-x-scroll py-2 pr-5 active:cursor-grabbing lg:py-3 lg:pr-5"
            onPointerEnter={() => {
              isHoveringRef.current = true;
            }}
            onPointerLeave={() => {
              isHoveringRef.current = false;
            }}
            onPointerDown={(event) => {
              if (event.button !== 0 && event.pointerType === "mouse") {
                return;
              }

              const carousel = carouselRef.current;

              if (!carousel) {
                return;
              }

              if (clickResetTimeoutRef.current !== null) {
                window.clearTimeout(clickResetTimeoutRef.current);
                clickResetTimeoutRef.current = null;
              }

              isDraggingRef.current = true;
              activePointerIdRef.current = event.pointerId;
              dragStartXRef.current = event.clientX;
              dragStartScrollLeftRef.current = carousel.scrollLeft;
              hasDraggedRef.current = false;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (
                !isDraggingRef.current ||
                activePointerIdRef.current !== event.pointerId
              ) {
                return;
              }

              const carousel = carouselRef.current;

              if (!carousel) {
                return;
              }

              const distance = event.clientX - dragStartXRef.current;

              if (Math.abs(distance) > 3) {
                hasDraggedRef.current = true;
              }

              carousel.scrollLeft = normalizeScrollPosition(
                dragStartScrollLeftRef.current - distance,
              );
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }

              endDrag(event.pointerId);
            }}
            onPointerCancel={(event) => {
              endDrag(event.pointerId);
            }}
            onLostPointerCapture={(event) => {
              endDrag(event.pointerId);
            }}
            onWheel={(event) => {
              const delta = event.deltaX || event.deltaY;

              if (delta === 0 || sequenceWidthRef.current <= 0) {
                return;
              }

              event.preventDefault();
              event.currentTarget.scrollLeft = normalizeScrollPosition(
                event.currentTarget.scrollLeft + delta,
              );
            }}
            onClickCapture={(event) => {
              if (hasDraggedRef.current) {
                event.preventDefault();
                event.stopPropagation();
                hasDraggedRef.current = false;
              }
            }}
          >
            <div className="flex w-max gap-3 lg:gap-5">
              {[0, 1].map((groupIndex) => (
                <div
                  key={groupIndex}
                  ref={groupIndex === 0 ? firstGroupRef : secondGroupRef}
                  aria-hidden={groupIndex === 1}
                  className="flex w-max gap-3 lg:gap-5"
                >
                  {loopItems.map((item, index) => (
                    <Link
                      key={`${groupIndex}-${index}-${item.userId}`}
                      href={`/u/${encodeURIComponent(item.username)}`}
                      tabIndex={groupIndex === 1 ? -1 : undefined}
                      className="
                        group
                        relative
                        h-[214px]
                        w-[174px]
                        lg:h-[250px]
                        lg:w-[210px]
                        flex-shrink-0
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
                      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
                        <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-orange-400/20 blur-3xl transition duration-500 group-hover:bg-orange-400/35" />
                        <div className="absolute -bottom-16 -left-12 h-36 w-36 rounded-full bg-amber-300/10 blur-3xl" />
                      </div>

                      <div className="relative flex h-full flex-col items-center px-4 pb-4 pt-5 text-center lg:px-5 lg:pb-5 lg:pt-6">
                        <div className="relative">
                          <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-orange-400 via-amber-300 to-orange-500 opacity-50 blur-md transition duration-500 group-hover:opacity-90" />
                          {/* eslint-disable-next-line @next/next/no-img-element -- creator avatars can be data URLs. */}
                          <img
                            src={getAvatarSrc(item.avatarUrl)}
                            alt={item.name}
                            onError={(event) => {
                              if (!event.currentTarget.src.endsWith(FALLBACK_AVATAR)) {
                                event.currentTarget.src = FALLBACK_AVATAR;
                              }
                            }}
                            className="relative h-[76px] w-[76px] rounded-full border-2 border-white/80 object-cover shadow-2xl transition duration-500 group-hover:scale-110 lg:h-[92px] lg:w-[92px]"
                          />
                        </div>

                        <div className="mt-4 min-w-0 w-full">
                          <div className="flex min-h-[2.5rem] items-start justify-center gap-1.5">
                            <h3 className="line-clamp-2 min-w-0 flex-1 text-sm font-black leading-tight text-white lg:text-base">
                              {item.name}
                            </h3>
                            {item.isVerified && (
                              <BadgeCheck size={16} className="flex-shrink-0 fill-orange-400 text-[#101827]" aria-label="Verified creator" />
                            )}
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-400">@{item.username}</p>
                        </div>

                        <div className="mt-auto flex items-center gap-1 rounded-full border border-orange-400/20 bg-orange-500/10 px-2.5 py-1 text-[10px] font-bold text-orange-200">
                          <Flame size={11} className="text-orange-400" />
                          {formatViews(item.windowViews)} today
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
