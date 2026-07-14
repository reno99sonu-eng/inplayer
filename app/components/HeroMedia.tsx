"use client";

import Image from "next/image";
import { Play, Radio, Star, Eye, Heart, TrendingUp } from "lucide-react";
import { featuredMovie } from "../data/hero";

export default function HeroMedia() {
  return (
    <div className="relative flex items-center justify-center">

      {/* Orange Ambient */}
      <div className="absolute -left-12 top-20 h-[280px] w-[280px] rounded-full bg-orange-500/20 blur-[150px] animate-ambientGlow" />

      {/* Blue Ambient */}
      <div
        className="absolute right-0 top-0 h-[240px] w-[240px] rounded-full bg-cyan-500/15 blur-[150px] animate-ambientGlow"
        style={{ animationDelay: "2s" }}
      />

      {/* Poster */}
      <div
        className="
          group
          relative
          z-10
          w-full
          max-w-[300px]
          md:max-w-[340px]
          lg:max-w-[360px]
          overflow-hidden
          rounded-[28px]
          lg:rounded-[36px]
          border
          border-white/10
          shadow-[0_50px_120px_rgba(0,0,0,.55)]
        "
      >

        <Image
          src={featuredMovie.poster}
          alt={featuredMovie.title}
          width={360}
          height={540}
          priority
          sizes="(max-width:768px)100vw,500px"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
          }}
          className="
            object-cover
            animate-cinematicZoom
            transition-transform
            duration-700
            group-hover:scale-105
          "
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Glass Reflection */}
        <div
          className="
            pointer-events-none
            absolute
            -left-44
            top-0
            h-full
            w-40
            rotate-[18deg]
            bg-white/40
            blur-2xl
            opacity-90
            animate-glassSweep
          "
        />

        {/* Streaming Badge */}
        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-[9px] font-bold tracking-wider text-white shadow-lg lg:left-5 lg:top-5 lg:gap-2 lg:px-3 lg:py-1.5 lg:text-[11px]">

          <Radio size={10} className="animate-pulse lg:h-3 lg:w-3" />

          NOW STREAMING

        </div>

        {/* HDR */}
        <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[9px] font-semibold text-white backdrop-blur-lg lg:right-5 lg:top-5 lg:px-3 lg:text-[11px]">

          4K HDR

        </div>

        {/* Play Button */}
        <button
          className="
            absolute
            left-1/2
            top-1/2
            flex
            h-12
            w-12
            lg:h-16
            lg:w-16
            -translate-x-1/2
            -translate-y-1/2
            items-center
            justify-center
            rounded-full
            border
            border-white/30
            bg-black/30
            backdrop-blur-xl
            shadow-[0_0_40px_rgba(249,115,22,.45)]
            transition-all
            duration-300
            hover:scale-110
            animate-playPulse
          "
        >
          <Play
            size={20}
            className="ml-0.5 text-white lg:ml-1"
            fill="white"
          />
        </button>

      </div>

      {/* Floating Premium Card */}
      <div
        className="
          absolute
          bottom-4
          left-3
          md:bottom-5
          md:left-4
          lg:bottom-6
          lg:left-4
          z-20
          w-36
          md:w-40
          lg:w-44
          overflow-hidden
          rounded-[22px]
          lg:rounded-[30px]
          border
          border-white/15
          bg-white/5
          backdrop-blur-[28px]
          shadow-[0_30px_80px_rgba(0,0,0,.45)]
          animate-floatingCard
        "
      >

        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-orange-500/15 blur-[90px]" />

        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />

        <div className="relative p-3 md:p-4 lg:p-5">

          <div
            className="
              inline-flex
              items-center
              gap-1
              lg:gap-2
              rounded-full
              border
              border-emerald-400/20
              bg-emerald-500/10
              px-2
              py-1
              lg:px-3
              lg:py-1.5
              text-[8px]
              lg:text-[10px]
              font-bold
              uppercase
              tracking-[0.18em]
              text-emerald-300
            "
          >

            <TrendingUp size={10} className="lg:h-3 lg:w-3" />

            TOP 1 IN INDIA

          </div>

          <h3
            className="
              mt-3
              text-lg
              md:text-xl
              lg:mt-5
              lg:text-2xl
              font-black
              tracking-[-0.04em]
              bg-gradient-to-r
              from-white
              via-slate-100
              to-orange-200
              bg-clip-text
              text-transparent
            "
          >
            {featuredMovie.title}
          </h3>

          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-yellow-500/10 px-2 py-1.5 lg:mt-4 lg:px-3 lg:py-2">

            <Star
              size={12}
              className="fill-yellow-400 text-yellow-400 lg:h-[15px] lg:w-[15px]"
            />

            <span className="text-xs lg:text-sm font-semibold text-white">

              IMDb {featuredMovie.imdb}

            </span>

          </div>

          <div className="mt-4 flex justify-between lg:mt-5">

            <div className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1.5 lg:gap-2 lg:px-3 lg:py-2">

              <Heart
                size={12}
                className="fill-pink-500 text-pink-500 lg:h-[14px] lg:w-[14px]"
              />

              <span className="text-[10px] lg:text-xs text-white">

                {featuredMovie.likes}

              </span>

            </div>

            <div className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1.5 lg:gap-2 lg:px-3 lg:py-2">

              <Eye
                size={12}
                className="text-slate-200 lg:h-[14px] lg:w-[14px]"
              />

              <span className="text-[10px] lg:text-xs text-white">

                {featuredMovie.views}

              </span>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}