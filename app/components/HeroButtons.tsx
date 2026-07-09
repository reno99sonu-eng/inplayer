"use client";

export default function HeroButtons() {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-5">

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
          px-9
          py-4
          text-[17px]
          font-bold
          text-white
          shadow-[0_15px_40px_rgba(249,115,22,0.45)]
          transition-all
          duration-300
          hover:-translate-y-1
          hover:scale-105
          hover:shadow-[0_20px_55px_rgba(249,115,22,0.65)]
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

        <span className="relative flex items-center gap-3">
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
          px-9
          py-4
          text-[17px]
          font-semibold
          text-white
          shadow-lg
          transition-all
          duration-300
          hover:-translate-y-1
          hover:border-white/30
          hover:bg-white/20
          hover:shadow-2xl
        "
      >
        Watch Trailer
      </button>

      {/* My List */}

      <button
        className="
          group
          rounded-full
          border
          border-white/15
          bg-transparent
          px-9
          py-4
          text-[17px]
          font-semibold
          text-white
          transition-all
          duration-300
          hover:-translate-y-1
          hover:border-orange-400
          hover:bg-orange-500/10
          hover:text-orange-300
          hover:shadow-[0_0_25px_rgba(249,115,22,0.25)]
        "
      >
        My List
      </button>

    </div>
  );
}