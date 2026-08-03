"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CONTENT_CATEGORIES } from "../data/categories";

// The first two chips are ORIENTATION toggles that drive the home feed
// (value "horizontal" = normal 16:9 videos, value "vertical" = Shorts).
// Displayed as "All" / "Verticals" per the current naming pass — the
// underlying ?view= values are unchanged so nothing downstream needs to
// know about the label swap. Everything after them is a topical content
// category (shared with the upload form via CONTENT_CATEGORIES) that
// filters the /videos listing.
const orientationTabs = [
  { label: "All", value: "horizontal" },
  { label: "Verticals", value: "vertical" },
];

const categories = CONTENT_CATEGORIES;

export default function NavigationCategories() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Hide category bar on chat screens and admin panel for clean full-height layout
  if (pathname.startsWith("/messages") || pathname.startsWith("/admin")) {
    return null;
  }

  const activeCategory = searchParams.get("category");

  // On the home page the orientation is driven by ?view=; anywhere else
  // neither orientation tab is "active" (they act as links back home).
  const onHome = pathname === "/";
  const activeView = searchParams.get("view") || "horizontal";

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftArrow(scrollLeft > 5);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    checkScrollState();
    el.addEventListener("scroll", checkScrollState, { passive: true });
    window.addEventListener("resize", checkScrollState, { passive: true });

    return () => {
      el.removeEventListener("scroll", checkScrollState);
      window.removeEventListener("resize", checkScrollState);
    };
  }, [checkScrollState]);

  const handleScroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = direction === "left" ? -280 : 280;
    el.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  // Convert mouse wheel vertical scroll to horizontal scroll for desktop users
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (e.deltaY !== 0) {
      el.scrollLeft += e.deltaY;
    }
  };

  const chipBase = `
    flex-shrink-0
    rounded-lg
    lg:rounded-xl
    px-2.5
    py-1
    lg:px-5
    lg:py-2.5
    text-xs
    lg:text-sm
    font-semibold
    transition-all
    duration-300
  `;

  const activeChip =
    "bg-white text-black light:bg-slate-900 light:text-white";
  const idleChip =
    "bg-white/10 text-white hover:bg-white/20 light:bg-black/[0.06] light:text-slate-800 light:hover:bg-black/10";

  return (
    <div
      className="
        relative
        sticky
        top-12
        lg:top-16
        z-40
        overflow-hidden
        border-b
        border-white/5
        light:border-black/10
        bg-[#06101D]/95
        light:bg-[#F5EEDC]/95
        backdrop-blur-2xl
      "
    >
      {/* Left Scroll Arrow Overlay (Desktop only — mobile uses touch swipe scroll) */}
      {showLeftArrow && (
        <div className="hidden lg:flex absolute left-0 top-0 bottom-0 z-10 items-center pl-2 pr-6 bg-gradient-to-r from-[#06101D] via-[#06101D]/90 to-transparent light:from-[#F5EEDC] light:via-[#F5EEDC]/90 light:to-transparent pointer-events-none">
          <button
            type="button"
            onClick={() => handleScroll("left")}
            aria-label="Scroll categories left"
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30 hover:scale-110 active:scale-95 light:bg-black/15 light:text-slate-900 light:hover:bg-black/25 shadow-lg backdrop-blur-md"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      )}

      {/* Right Scroll Arrow Overlay (Desktop only — mobile uses touch swipe scroll) */}
      {showRightArrow && (
        <div className="hidden lg:flex absolute right-0 top-0 bottom-0 z-10 items-center pr-2 pl-6 bg-gradient-to-l from-[#06101D] via-[#06101D]/90 to-transparent light:from-[#F5EEDC] light:via-[#F5EEDC]/90 light:to-transparent pointer-events-none">
          <button
            type="button"
            onClick={() => handleScroll("right")}
            aria-label="Scroll categories right"
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30 hover:scale-110 active:scale-95 light:bg-black/15 light:text-slate-900 light:hover:bg-black/25 shadow-lg backdrop-blur-md"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        className="
          flex
          gap-2
          lg:gap-3
          overflow-x-auto
          whitespace-nowrap
          px-4
          lg:px-5
          pt-2
          lg:pt-3
          pb-2
          lg:pb-3
          overscroll-x-contain
          scroll-smooth
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {/* Orientation toggles (Horizontal / Vertical) */}
        {orientationTabs.map((tab) => {
          const isActive = onHome && activeView === tab.value;
          const href =
            tab.value === "horizontal" ? "/" : `/?view=${tab.value}`;

          return (
            <Link
              key={tab.value}
              href={href}
              className={`${chipBase} ${isActive ? activeChip : idleChip}`}
            >
              {tab.label}
            </Link>
          );
        })}

        {/* Thin divider between orientation toggles and content categories */}
        <span
          aria-hidden
          className="my-1 w-px flex-shrink-0 self-stretch bg-white/10 light:bg-black/10"
        />

        {/* Content categories */}
        {categories.map((category) => {
          const isActive =
            pathname === "/videos" && activeCategory === category;
          const href = `/videos?category=${encodeURIComponent(category)}`;

          return (
            <Link
              key={category}
              href={href}
              className={`${chipBase} ${isActive ? activeChip : idleChip}`}
            >
              {category}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

