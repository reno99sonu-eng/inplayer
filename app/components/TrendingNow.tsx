"use client";

import Image from "next/image";

import { trending } from "../data/trending";

export default function TrendingNow() {
  return (
    <section className="relative mx-auto max-w-[1700px] px-5 pt-8 pb-6">

<div className="pointer-events-none absolute inset-0">

<h1
  className="
    absolute
    left-4
    top-10
    select-none
    text-[120px]
    font-black
    tracking-[-0.08em]
    text-white/[0.025]
    lg:left-8
    lg:top-2
    lg:text-[220px]
  "
>
  TRENDING
</h1>

</div>

      <div className="mb-6 flex items-center justify-between">

        <div>

          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.25em] text-red-300">
            Trending
          </span>

          <h2 className="mt-3 text-3xl font-black text-white">
            Trending Now
          </h2>

        </div>

        <button className="hidden md:block rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:border-orange-400 hover:text-orange-300">
          View All →
        </button>

      </div>

      <div
  className="
    flex
    gap-5
    overflow-x-auto scroll-smooth
    pt-3
    -mt-3
    pb-2
    pl-8
    lg:pl-10
    snap-x
    snap-mandatory
    scrollbar-hide
  "
>

        {trending.map((item) => (

          <button
          key={item.id}
            className="
              group
              relative
              h-[230px]
              w-[190px]
              flex-shrink-0
              snap-start
              overflow-hidden
              rounded-[28px]
              border
              border-white/10
              bg-[#101827]
              transition-all
              duration-300
              hover:-translate-y-1 hover:scale-[1.03]
              hover:border-orange-400/40
              hover:shadow-[0_0_50px_rgba(249,115,22,.22)]
            "
          >

<Image
  src={item.thumbnail}
  alt={item.title}
  fill
  className="object-cover object-top transition duration-500 group-hover:scale-105"
/>

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

            <div className="absolute bottom-0 w-full p-4">

            <h3 className="text-base font-black text-white">
  {item.title}
</h3>

              <p className="mt-1 text-xs text-slate-300">
                {item.creator}
              </p>

            </div>

          </button>

        ))}

      </div>

    </section>
  );
}