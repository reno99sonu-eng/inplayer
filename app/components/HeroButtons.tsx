"use client";

export default function HeroButtons() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">

      {/* Watch Now */}

      <button
        className="
          group
          relative
          overflow-hidden
          rounded-full
          bg-gradient-to-r
          from-orange-500
          via-orange-400
          to-red-500
          px-6
          py-2.5
          text-sm
          font-bold
          text-white
          shadow-[0_10px_25px_rgba(249,115,22,0.35)]
          transition-all
          duration-300
          hover:-translate-y-1
          hover:scale-105
          hover:shadow-[0_15px_35px_rgba(249,115,22,0.5)]
        "
      >
        <span
          className="
            absolute
            -left-16
            top-0
            h-full
            w-12
            -skew-x-12
            bg-white/25
            transition-all
            duration-1000
            group-hover:left-[120%]
          "
        />

        <span className="relative flex items-center gap-2">
          ▶
          Watch Now
        </span>
      </button>

      {/* Trailer */}

      <button
        className="
          group
          rounded-full
          border
          border-white/15
          bg-white/10
          backdrop-blur-xl
          px-6
          py-2.5
          text-sm
          font-semibold
          text-white
          shadow-lg
          transition-all
          duration-300
          hover:-translate-y-1
          hover:border-white/30
          hover:bg-white/20
          hover:shadow-xl
        "
      >
        Trailer
      </button>

      {/* My List */}

      <button
        className="
          group
          rounded-full
          border
          border-white/15
          bg-transparent
          px-6
          py-2.5
          text-sm
          font-semibold
          text-white
          transition-all
          duration-300
          hover:-translate-y-1
          hover:border-orange-400
          hover:bg-orange-500/10
          hover:text-orange-300
          hover:shadow-[0_0_20px_rgba(249,115,22,0.2)]
        "
      >
        My List
      </button>

    </div>
  );
}