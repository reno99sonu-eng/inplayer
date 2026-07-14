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
        max-w-[560px]
        flex-col
        justify-end

        pt-4
        pb-4

        sm:pt-5
        sm:pb-5

        md:pt-6
        md:pb-6

        lg:justify-center
        lg:pt-0
        lg:pb-0
      "
    >
      {/* Badge */}

      <div
        className="
          mb-3
          inline-flex
          w-fit
          items-center
          rounded-full
          border
          border-orange-400/40
          bg-orange-500/10
          px-3
          py-1.5
          backdrop-blur-xl
        "
      >
        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />

        <span
          className="
            ml-2
            text-[9px]
            font-black
            uppercase
            tracking-[0.24em]
            text-orange-300
          "
        >
          🔥 WEEKLY FEATURED
        </span>
      </div>

      {/* Title */}

      <h1
        className="
          text-3xl
          font-black
          leading-[0.9]
          tracking-[-0.05em]
          text-white

          sm:text-4xl

          md:text-5xl

          lg:text-6xl
        "
      >
        30 Days
        <br />
        Without Limits
      </h1>

      {/* Description */}

      <p
        className="
          mt-3
          max-w-[480px]
          text-sm
          text-slate-300
        "
      >
        Unlimited streaming. Watch anytime, anywhere.
      </p>

      <div className="mt-3 flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-white">
          by @ArjunCreates
        </span>

        <span className="text-xs font-medium text-emerald-400">
          ✓ Verified Creator
        </span>
      </div>

      {/* Creator Information */}

      <div
        className="
          mt-4
          flex
          flex-wrap
          items-center
          gap-x-2
          gap-y-1
          text-[11px]
          text-slate-300
        "
      >
        <span>👁 12.8M Views</span>

        <span className="text-orange-400">•</span>

        <span>18 min</span>

        <span className="text-orange-400">•</span>

        <span>🌍 7 Languages</span>

        <span className="text-orange-400">•</span>

        <span>💬 33 Subtitles</span>

        <span className="text-orange-400">•</span>

        <span className="font-semibold text-orange-300">
          🔥 #1
        </span>
      </div>

      {/* Buttons */}

      <div className="mt-5">
        <FeaturedHeroButtons />
      </div>
    </div>
  );
}