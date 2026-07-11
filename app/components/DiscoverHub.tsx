"use client";
import Image from "next/image";
const categories = [
    {
      title: "Movies",
      subtitle: "18,000+ Titles",
      badge: "POPULAR",
      image: "/posters/discover/movies.jpg",
    },
    {
      title: "TV Shows",
      subtitle: "Series & Originals",
      badge: "TRENDING",
      image: "/posters/discover/tv.jpg",
    },
    {
      title: "Live",
      subtitle: "Events & Streams",
      badge: "LIVE",
      image: "/posters/discover/live.jpg",
    },
    {
      title: "Shorts",
      subtitle: "Quick Entertainment",
      badge: "NEW",
      image: "/posters/discover/shorts.jpg",
    },
    {
      title: "News & Weather",
      subtitle: "India & World",
      badge: "24×7",
      image: "/posters/discover/news.jpg",
    },
    {
      title: "Kids",
      subtitle: "Family Safe",
      badge: "FUN",
      image: "/posters/discover/kids.jpg",
    },
    {
      title: "Gaming",
      subtitle: "Esports & Streams",
      badge: "LIVE",
      image: "/posters/discover/gaming.jpg",
    },
    {
      title: "Music",
      subtitle: "Albums & Videos",
      badge: "TOP",
      image: "/posters/discover/music.jpg",
    },
    {
      title: "Fashion",
      subtitle: "Style & Beauty",
      badge: "NEW",
      image: "/posters/discover/fashion.jpg",
    },
    {
      title: "Meditation",
      subtitle: "Mind & Wellness",
      badge: "ZEN",
      image: "/posters/discover/meditation.jpg",
    },
    {
      title: "Podcasts",
      subtitle: "Audio Originals",
      badge: "HOT",
      image: "/posters/discover/podcasts.jpg",
    },
  ];

export default function DiscoverHub() {
  return (
    <section className="relative mx-auto max-w-[1700px] overflow-hidden px-5 py-10">

<div className="pointer-events-none absolute inset-0">

<div className="absolute -left-24 top-20 h-96 w-96 rounded-full bg-orange-500/10 blur-[120px]" />

<div className="absolute right-0 bottom-0 h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-[160px]" />

<div className="absolute left-8 top-8 text-[170px] font-black tracking-[-0.08em] text-white/[0.025] lg:text-[260px]">
  DISCOVER
</div>

</div>

      <div className="mb-8 flex items-end justify-between">

        <div>
          <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.25em] text-orange-300">
            Discover
          </span>

          <h2 className="mt-4 text-3xl font-black text-white md:text-5xl">
            Explore Everything
          </h2>

          <p className="mt-3 max-w-2xl text-slate-400">
  Movies, TV Shows, Live, News & Weather, Gaming,
  Music, Kids, Podcasts, Fashion and much more.
</p>
        </div>

        <button className="hidden md:block rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:border-orange-400 hover:text-orange-300">
          View All →
        </button>

      </div>

      <div
  className="
    flex
    gap-5
    overflow-x-auto
    pb-2
    snap-x
    snap-mandatory
    scrollbar-hide

    lg:gap-6
    lg:overflow-x-auto
    lg:overflow-y-hidden
    lg:scrollbar-hide
  "
>
        {categories.map((category) => (

          <button
            key={category.title}
            className="
              w-[185px]
              sm:w-[220px]
              md:w-[240px]
              lg:w-[330px]
              flex-shrink-0
              snap-start
              group
              overflow-hidden
              rounded-3xl
              border
              border-white/10
              bg-[#0A1322]
              text-left
              transition-all
              duration-300
              hover:-translate-y-1
              hover:border-orange-400/40
              hover:shadow-[0_0_40px_rgba(249,115,22,.18)]
            "
          >

<div className="relative h-40 lg:h-44 overflow-hidden">

<Image
  src={category.image}
  alt={category.title}
  fill
  className="
    object-cover
    transition-transform
    duration-500
    group-hover:scale-105
  "
/>

<div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />



</div>

            <div className="p-5">

              <h3 className="
text-xl
lg:text-2xl
font-black
tracking-[-0.03em]
text-white
transition-colors
duration-300
group-hover:text-orange-300
"
>
                {category.title}
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                {category.subtitle}
              </p>

              <div className="mt-5 font-semibold text-orange-400">
                Explore →
              </div>

            </div>

          </button>

        ))}
      </div>

    </section>
  );
}