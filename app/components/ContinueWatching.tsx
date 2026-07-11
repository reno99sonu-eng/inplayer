"use client";

import Image from "next/image";
import { continueWatching } from "../data/continueWatching";

export default function ContinueWatching() {
  return (
    <section className="relative overflow-hidden bg-[#030712] px-6 pb-16">

      {/* Background Word */}
      <h1 className="pointer-events-none absolute left-8 top-0 select-none text-[170px] font-black uppercase tracking-[-10px] text-white/[0.025]">
        CONTINUE
      </h1>

      <div className="relative z-10 mx-auto max-w-[1600px]">

        {/* Header */}
        <div className="mb-8 flex items-end justify-between">

          <div>
            <h2 className="text-4xl font-black tracking-[-0.03em] text-white">
              Continue Watching
            </h2>

            <p className="mt-2 text-slate-400">
              Resume your latest entertainment.
            </p>
          </div>

          <button className="text-sm font-semibold text-orange-400 transition duration-300 hover:translate-x-1 hover:text-orange-300">
            View All →
          </button>

        </div>

        {/* Cards */}
        <div
          className="
            flex
            gap-6
            overflow-x-auto
            pb-0
            [-ms-overflow-style:none]
            [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden
          "
        >

          {continueWatching.map((movie, index) => (

            <div
              key={movie.id}
              className="group min-w-[220px] animate-fadeInUp"
              style={{
                animationDelay: `${index * 120}ms`,
              }}
            >

              {/* Poster */}
              <div className="relative overflow-hidden rounded-[26px] shadow-[0_20px_45px_rgba(0,0,0,.45)]">

                <Image
                  src={movie.image}
                  alt={movie.title}
                  width={220}
                  height={330}
                  className="transition duration-500 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                <div className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
                  {movie.progress}% Watched
                </div>

              </div>

              <h3
                className="
                  mt-4
                  line-clamp-2
                  text-[17px]
                  font-extrabold
                  leading-[1.35]
                  tracking-[-0.02em]
                  text-white
                  transition-all
                  duration-300
                  group-hover:text-orange-300
                  group-hover:translate-x-1
                "
              >
                {movie.title}
              </h3>

              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">

                <span className="rounded-full bg-white/5 px-2 py-1 backdrop-blur-sm">
                  HD
                </span>

                <span>•</span>
                <span>{movie.duration}</span>
                <span>•</span>
                <span>Continue</span>

              </div>

              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-700 w-full max-w-[220px]">

  <div
    className="h-full rounded-full bg-gradient-to-r from-orange-500 via-orange-400 to-orange-300"
    style={{
      width: `${movie.progress}%`,
    }}
  />

</div>

            </div>

          ))}

        </div>

      </div>

    </section>
  );
}