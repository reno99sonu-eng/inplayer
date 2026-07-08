"use client";

import { Crown } from "lucide-react";

export default function PremiumBanner() {
  return (
    <section className="mx-auto mt-28 max-w-[1600px] px-4 md:px-8">

      <div
        className="
          overflow-hidden
          rounded-[36px]
          bg-gradient-to-r
          from-[#0F172A]
          via-[#1E293B]
          to-[#111827]
          p-10
          md:p-16
          shadow-[0_30px_80px_rgba(15,23,42,0.30)]
        "
      >

        <div className="max-w-3xl">

          <div className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-2 text-sm font-bold text-slate-900">

            <Crown size={16} />

            PREMIUM

          </div>

          <h2 className="mt-8 text-4xl font-black leading-tight text-white md:text-6xl">
            Experience Streaming
            <br />
            Without Limits
          </h2>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Enjoy 4K HDR, Dolby Atmos, exclusive originals,
            creator content, AI-powered recommendations,
            downloads and an ad-free premium experience.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">

            <button
              className="
                rounded-full
                bg-gradient-to-r
                from-yellow-400
                to-orange-500
                px-8
                py-4
                font-bold
                text-slate-900
                transition
                hover:scale-105
              "
            >
              Upgrade Now
            </button>

            <button
              className="
                rounded-full
                border
                border-white/20
                px-8
                py-4
                font-semibold
                text-white
                transition
                hover:bg-white/10
              "
            >
              Learn More
            </button>

          </div>

        </div>

      </div>

    </section>
  );
}