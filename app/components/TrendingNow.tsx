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
    <section className="mx-auto max-w-[1800px] px-3 py-1.5 lg:px-6 lg:py-2">
      <div className="mb-1.5 flex items-end justify-between lg:mb-2">
        <div>
          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 lg:px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-red-300 light:text-red-600 backdrop-blur-sm">
            Trending today
          </span>

          <h2 className="mt-0.5 text-base lg:text-lg font-black tracking-tight text-white light:text-slate-900">
            Trending Creators
          </h2>
        </div>
      </div>

      <div className="relative">
        {items === null ? (
          <div className="flex gap-2 px-1 py-1 lg:gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="flex w-20 flex-shrink-0 flex-col items-center gap-1 sm:w-22 lg:w-24"
              >
                <div className="h-14 w-14 animate-pulse rounded-full bg-white/[0.06] sm:h-16 sm:w-16 lg:h-16 lg:w-16" />
                <div className="h-2 w-10 animate-pulse rounded-full bg-white/[0.06]" />
                <div className="h-1.5 w-6 animate-pulse rounded-full bg-white/[0.05]" />
              </div>
            ))}
          </div>
        ) : (
          <div
            ref={carouselRef}
            className="cursor-grab touch-pan-y select-none overflow-x-scroll py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden active:cursor-grabbing"
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
            <div className="flex w-max gap-2 lg:gap-3">
              {[0, 1].map((groupIndex) => (
                <div
                  key={groupIndex}
                  ref={groupIndex === 0 ? firstGroupRef : secondGroupRef}
                  aria-hidden={groupIndex === 1}
                  className="flex w-max gap-2 lg:gap-3"
                >
                  {loopItems.map((item, index) => (
                    <Link
                      key={`${groupIndex}-${index}-${item.userId}`}
                      href={`/u/${encodeURIComponent(item.username)}`}
                      tabIndex={groupIndex === 1 ? -1 : undefined}
                      aria-label={`Open ${item.name}'s channel`}
                      className="group flex w-20 flex-shrink-0 flex-col items-center gap-1 text-center sm:w-22 lg:w-24"
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
          </div>
        )}
      </div>
    </section>
  );
}
