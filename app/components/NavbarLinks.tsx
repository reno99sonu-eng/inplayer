"use client";

export default function NavbarLinks() {
  const links = [
    "Home",
    "Movies",
    "TV Shows",
  ];

  return (
    <nav className="flex items-center gap-10">
      {links.map((item, index) => (
        <button
          key={item}
          className={`relative text-lg font-semibold transition-all duration-300 ${
            index === 0
              ? "text-orange-500"
              : "text-slate-700 hover:text-orange-500"
          }`}
        >
          {item}

          {index === 0 && (
            <span className="absolute -bottom-3 left-0 h-1 w-full rounded-full bg-orange-500" />
          )}
        </button>
      ))}
    </nav>
  );
}