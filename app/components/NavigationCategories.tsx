"use client";

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
  return (
    <div
      className="
        sticky
        top-16
        lg:top-20
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
      <div
        className="
          flex
          gap-3
          overflow-x-auto
          whitespace-nowrap
          px-4
          lg:px-5
          pt-1
          lg:pt-3
          pb-7
          lg:pb-9
          -mb-4
          lg:-mb-6
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {categories.map((category, index) => (
          <button
            key={category}
            className={`
              flex-shrink-0
              rounded-xl
              px-5
              py-2
              lg:py-2.5
              text-sm
              font-semibold
              transition-all
              duration-300
              ${
                index === 0
                  ? "bg-white text-black light:bg-slate-900 light:text-white"
                  : "bg-white/10 text-white hover:bg-white/20 light:bg-black/5 light:text-slate-700 light:hover:bg-black/10"
              }
            `}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}