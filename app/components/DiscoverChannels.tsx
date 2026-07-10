"use client";

export default function TopCreators() {
  const channels = [
    {
      name: "Creator Academy",
      category: "Education",
      subscribers: "4.8M Subscribers",
      badge: "LEARNING",
      poster: "/posters/poster7.jpg",
    },
    {
      name: "FitZone",
      category: "Fitness",
      subscribers: "8.9M Subscribers",
      badge: "TRENDING",
      poster: "/posters/poster8.jpg",
    },
    {
      name: "Chef's Table",
      category: "Food & Cooking",
      subscribers: "6.7M Subscribers",
      badge: "POPULAR",
      poster: "/posters/poster9.jpg",
    },
    {
      name: "Football Live",
      category: "Sports",
      subscribers: "15.3M Subscribers",
      badge: "LIVE",
      poster: "/posters/poster10.jpg",
    },
  ];

  return (
    <section className="relative mx-auto mt-24 max-w-[1600px] overflow-hidden px-4 md:px-8">

      {/* Giant Background Text */}
      <h1
        className="
          pointer-events-none
          absolute
          left-1/2
          top-8
          z-0
          -translate-x-1/2
          whitespace-nowrap
          text-[120px]
          md:text-[180px]
          font-black
          tracking-[-0.08em]
          text-white/[0.04]
          select-none
        "
      >
        CHANNELS
      </h1>

      {/* Heading */}
      <div className="relative z-10 mb-16 text-center">

        <span
          className="
            inline-flex
            rounded-full
            border
            border-red-500/20
            bg-red-500/10
            px-6
            py-2
            text-[11px]
            font-bold
            uppercase
            tracking-[0.35em]
            text-red-400
            backdrop-blur-xl
          "
        >
          DISCOVER CHANNELS
        </span>

        <h2
          className="
            mt-6
            text-5xl
            font-black
            leading-[0.95]
            tracking-[-0.05em]
            text-white
            md:text-6xl
          "
        >
          Find Your
          <br />
          Next Favorite Creator
        </h2>

        <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-400">
          Explore trending creators, premium channels, live broadcasts and
          exclusive entertainment curated for you.
        </p>

      </div>

      {/* Cards */}
      <div className="relative z-10 grid gap-7 md:grid-cols-2 xl:grid-cols-4">

        {channels.map((channel) => (

          <div
            key={channel.name}
            className="
              group
              overflow-hidden
              rounded-[30px]
              border
              border-white/10
              bg-[#111827]/80
              backdrop-blur-xl
              shadow-2xl
              transition-all
              duration-500
              hover:-translate-y-3
              hover:border-orange-400/50
              hover:shadow-[0_30px_80px_rgba(249,115,22,.25)]
            "
          >

            {/* Poster */}
            <div className="relative h-44 overflow-hidden">

              <img
                src={channel.poster}
                alt={channel.name}
                className="
                  h-full
                  w-full
                  object-cover
                  object-[center_25%]
                  transition-transform
                  duration-700
                  group-hover:scale-110
                "
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

              <span className="absolute right-4 top-4 rounded-full bg-red-600 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-white">
                {channel.badge}
              </span>

            </div>

            {/* Avatar */}
            <div className="relative z-10 -mt-8 mb-3 flex justify-center">

              <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#111827] bg-gradient-to-br from-red-500 to-orange-500 text-xl font-black text-white shadow-2xl">
                {channel.name.charAt(0)}
              </div>

            </div>

            {/* Content */}
            <div className="px-6 pb-6 text-center">

              <h3 className="text-xl font-black text-white">
                {channel.name}
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                {channel.category}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {channel.subscribers}
              </p>

              <button
                className="
                  mt-6
                  w-full
                  rounded-xl
                  bg-gradient-to-r
                  from-red-500
                  to-orange-500
                  py-3
                  text-sm
                  font-semibold
                  text-white
                  transition-all
                  duration-300
                  hover:scale-[1.03]
                  hover:shadow-lg
                  hover:shadow-orange-500/30
                "
              >
                Subscribe
              </button>

            </div>

          </div>

        ))}

      </div>

    </section>
  );
}