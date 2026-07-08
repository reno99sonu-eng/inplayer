"use client";

const links = [
  "Home",
  "Movies",
  "TV Shows",
  "Shorts",
  "Live",
  "Creators",
  "Gaming",
  "Music",
];

export default function NavbarLinks() {
  return (
    <nav className="hidden xl:flex items-center gap-8">

      {links.map((item, index) => (

        <button
          key={item}
          className={`
            group
            relative
            text-[15px]
            font-medium
            transition-all
            duration-300

            ${
              index === 0
                ? "text-orange-500"
                : "text-slate-700 hover:text-slate-900"
            }
          `}
        >

          {item}

          <span
            className={`
              absolute
              left-0
              -bottom-2
              h-[3px]
              rounded-full
              bg-gradient-to-r
              from-orange-400
              via-orange-500
              to-amber-400
              transition-all
              duration-300

              ${
                index === 0
                  ? "w-full"
                  : "w-0 group-hover:w-full"
              }
            `}
          />

        </button>

      ))}

    </nav>
  );
}