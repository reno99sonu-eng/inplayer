"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
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
  const activeCategory = searchParams.get("category");

  // On the home page the orientation is driven by ?view=; anywhere else
  // neither orientation tab is "active" (they act as links back home).
  const onHome = pathname === "/";
  const activeView = searchParams.get("view") || "horizontal";

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
      {/* Extra 24px of bottom padding pushes any native scrollbar past the
          visible area, and the matching negative margin pulls the box back
          up — the parent's overflow-hidden clips that strip away entirely.
          This hides scrollbars even where scrollbar-hiding CSS properties
          have no effect (some Android browsers render a native overlay
          scroll indicator that isn't part of the CSS scrollbar system). */}
      <div
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
          pb-7
          -mb-4
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
