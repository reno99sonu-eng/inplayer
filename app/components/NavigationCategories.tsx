"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

const categories = [
  "All",
  "Movies",
  "Trending",
  "Music",
  "Gaming",
  "AI",
  "Live",
  "Podcasts",
  "News",
  "Sports",
  "Kids",
  "Comedy",
  "Education",
];

export default function NavigationCategories() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const activeCategory = searchParams.get("category");

  return (
    <div
      className="
        sticky
        top-20
        z-40
        overflow-hidden
        border-b
        border-white/5
        light:border-black/5
        bg-[#06101D]/95
        light:bg-white/95
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
          gap-3
          overflow-x-auto
          whitespace-nowrap
          px-5
          pt-3
          pb-9
          -mb-6
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {categories.map((category) => {
          const isActive =
            category === "All" ? !activeCategory : activeCategory === category;

          const href =
            category === "All"
              ? "/videos"
              : `/videos?category=${encodeURIComponent(category)}`;

          return (
            <Link
              key={category}
              href={href}
              className={`
                flex-shrink-0
                rounded-xl
                px-5
                py-2.5
                text-sm
                font-semibold
                transition-all
                duration-300

                ${
                  isActive
                    ? "bg-white text-black light:bg-slate-900 light:text-white"
                    : "bg-white/10 text-white hover:bg-white/20 light:bg-black/5 light:text-slate-700 light:hover:bg-black/10"
                }
              `}
            >
              {category}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
