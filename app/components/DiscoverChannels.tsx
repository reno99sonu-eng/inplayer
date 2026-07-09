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

      {/* Background Text */}

      <h1 className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-[150px] font-black tracking-[-0.08em] text-slate-200/40 select-none">
        CHANNELS
      </h1>

      {/* Heading */}

      <div className="relative mb-14 text-center">

        <span className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-5 py-2 text-[11px] font-bold uppercase tracking-[0.35em] text-red-500">
          DISCOVER CHANNELS
        </span>

        <h2 className="mt-6 text-5xl font-black leading-[0.92] tracking-[-0.05em] text-slate-900 md:text-6xl">
          Find Your
          <br />
          Next Favorite Creator
        </h2>

        <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-500">
          Explore trending creators, premium channels, live broadcasts and
          exclusive entertainment curated for you.
        </p>

      </div>

      {/* Channel Cards */}

      <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-4">

        {channels.map((channel, index) => (

          <div
            key={channel.name}
            className="
              group
              overflow-hidden
              rounded-[30px]
              border
              border-slate-200
              bg-white
              shadow-xl
              transition-all
              duration-500
              hover:-translate-y-3
              hover:shadow-[0_30px_60px_rgba(0,0,0,.15)]
            "
          >

            {/* Banner */}

            <div className="relative h-44 overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900">

            <img
  src={channel.poster}
  alt={channel.name}
  className="
    h-full
    w-full
    object-cover
    object-[center_25%]
    transition-all
    duration-700
    group-hover:scale-110
  "
/>

              <span className="absolute right-4 top-4 rounded-full bg-red-600 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-white">
                {channel.badge}
              </span>

            </div>

            {/* Avatar */}

            <div className="relative z-10 -mt-8 mb-3 flex justify-center">

            <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-red-500 to-orange-500 text-lg font-black text-white shadow-xl">
                {channel.name.charAt(0)}
              </div>

            </div>

            {/* Content */}

            <div className="px-6 pt-2 pb-6 text-center">

              <h3 className="text-xl font-black text-slate-900">
                {channel.name}
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                {channel.category}
              </p>

              <p className="mt-1 text-xs font-medium text-slate-400">
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
                  hover:scale-[1.02]
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