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
        top-20
        z-40
        border-b
        border-white/5
        bg-[#06101D]/95
        backdrop-blur-2xl
      "
    >
      <div
        className="
          flex
          gap-3
          overflow-x-auto
          px-5
          py-3
          scrollbar-hide
          whitespace-nowrap
        "
      >
        {categories.map((category, index) => (
          <button
            key={category}
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
                index === 0
                  ? "bg-white text-black"
                  : "bg-white/10 text-white hover:bg-white/20"
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