"use client";

import FeaturedHeroButtons from "./FeaturedHeroButtons";

export default function FeaturedHeroContent() {
  return (
    <div
      className="
        relative
        z-20
        flex
        w-full
        max-w-[760px]
        flex-col
        justify-end

        pt-10
        pb-8

        sm:pt-12
        sm:pb-10

        md:pt-16
        md:pb-14

        lg:justify-center
        lg:pt-0
        lg:pb-0
      "
    >
      {/* Badge */}

      <div
        className="
          mb-5
          inline-flex
          w-fit
          items-center
          rounded-full
          border
          border-orange-400/40
          bg-orange-500/10
          px-4
          py-2
          backdrop-blur-xl

          sm:px-5

          lg:mb-6
        "
      >
        <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />

        <span
          className="
            ml-3
            text-[10px]
            font-black
            uppercase
            tracking-[0.28em]
            text-orange-300

            sm:text-xs
          "
        >
          🔥 WEEKLY FEATURED
        </span>
      </div>

      {/* Title */}

      <h1
        className="
          text-[58px]
          font-black
          leading-[0.88]
          tracking-[-0.06em]
          text-white

          sm:text-[68px]

          md:text-7xl

          lg:text-7xl

          xl:text-8xl
        "
      >
      30 Days
      <br />
      Without Limits
      </h1>

      {/* Description */}

      <p
        className="
          mt-6
          max-w-[660px]

          text-[16px]
          leading-8

          text-slate-300

          sm:text-[17px]

          md:text-lg

          lg:mt-8
          lg:text-xl
        "
      >
        The most watched creator this week. Featured automatically through verified reach, watch time, engagement, and community activity across InPlayer.
      </p>

      <div className="mt-5 flex flex-col gap-1">
  <span className="text-base font-semibold text-white">
    by @ArjunCreates
  </span>

  <span className="text-sm font-medium text-emerald-400">
    ✓ Verified Creator
  </span>
</div>

      {/* Creator Information */}

      <div
        className="
          mt-7
          flex
          flex-wrap
          items-center
          gap-x-3
          gap-y-2

          text-[11px]

          sm:text-xs

          md:text-sm

          lg:mt-8
          lg:text-base

          text-slate-300
        "
      >
        <span className="whitespace-nowrap">👁 12.8M Views</span>

        <span className="text-orange-400">•</span>

        <span className="whitespace-nowrap">18 min</span>

        <span className="text-orange-400">•</span>

        <span className="whitespace-nowrap">
          🌍 Audio in 7 Languages
        </span>

        <span className="text-orange-400">•</span>

        <span className="whitespace-nowrap">
          💬 Subtitles in 33 Languages
        </span>

        <span className="text-orange-400">•</span>

        <span className="whitespace-nowrap font-semibold text-orange-300">
          🔥 Trending #1
        </span>
      </div>

      {/* Buttons */}

      <div className="mt-8 lg:mt-10">
        <FeaturedHeroButtons />
      </div>
    </div>
  );
}