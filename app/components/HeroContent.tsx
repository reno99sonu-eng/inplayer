"use client";

import { featuredMovie } from "../data/hero";
import HeroButtons from "./HeroButtons";

export default function HeroContent() {
  return (
    <div
      className="
        relative
        z-20
        flex
        max-w-[650px]
        flex-col
        justify-center
        py-10
        lg:py-14
      "
    >
      {/* Premium Badge */}

      <div className="mb-7">
        <div
          className="
            group
            relative
            inline-flex
            items-center
            overflow-hidden
            rounded-full
            border
            border-orange-500/40
            bg-gradient-to-r
            from-[#321306]
            via-[#5f2509]
            to-[#321306]
            px-6
            py-2.5
            shadow-[0_0_30px_rgba(249,115,22,0.25)]
            transition-all
            duration-500
            hover:scale-[1.04]
            hover:border-orange-300
            hover:shadow-[0_0_55px_rgba(249,115,22,0.55)]
          "
        >
          <div
            className="
              absolute
              -left-16
              top-0
              h-full
              w-12
              -skew-x-12
              bg-white/20
              opacity-70
              transition-all
              duration-1000
              group-hover:left-[120%]
            "
          />

          <span className="mr-3 h-2.5 w-2.5 rounded-full bg-orange-400 shadow-[0_0_18px_#fb923c] animate-pulse" />

          <span
            className="
              text-xs
              font-black
              uppercase
              tracking-[0.32em]
              text-orange-200
            "
          >
            {featuredMovie.subtitle}
          </span>
        </div>
      </div>

      {/* Title */}

      <h1
        className="
          text-5xl
          font-black
          leading-[0.92]
          tracking-[-0.06em]
          text-white
          drop-shadow-[0_15px_40px_rgba(0,0,0,0.45)]
          md:text-7xl
        "
      >
        {featuredMovie.title}
      </h1>

      {/* Movie Meta */}

      <div className="mt-7 flex flex-wrap items-center gap-4 text-[15px] font-medium">

        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-slate-200 backdrop-blur-xl">
          {featuredMovie.year}
        </span>

        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_12px_#fb923c]" />

        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-slate-200 backdrop-blur-xl">
          {featuredMovie.duration}
        </span>

        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_12px_#fb923c]" />

        <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-1.5 font-semibold text-cyan-300">
          4K HDR
        </span>

        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_12px_#fb923c]" />

        <span className="rounded-full border border-red-400/20 bg-red-500/10 px-4 py-1.5 font-semibold text-red-300">
          U/A 18+
        </span>

      </div>

      {/* Description */}

      <p
        className="
          mt-9
          max-w-[640px]
          text-[20px]
          font-light
          leading-[2.15rem]
          tracking-[0.01em]
          text-slate-200/95
        "
      >
        {featuredMovie.description}
      </p>

      {/* Divider */}

      <div className="mt-10 h-px w-28 rounded-full bg-gradient-to-r from-orange-500 via-orange-300 to-transparent opacity-70" />

      {/* Buttons */}

      <div className="mt-8">
        <HeroButtons />
      </div>
    </div>
  );
}