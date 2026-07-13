"use client";

import {
  TrendingUp,
  Eye,
  Heart,
  Globe,
} from "lucide-react";

export default function FeaturedHeroStats() {
  return (
    <div
      className="
        absolute
        bottom-8
        right-8
        z-30
        hidden
        xl:block
      "
    >
      <div
        className="
          w-[320px]
          rounded-[32px]
          border
          border-white/10
          bg-white/5
          backdrop-blur-3xl
          shadow-[0_30px_80px_rgba(0,0,0,.45)]
          p-6
        "
      >
        <div className="mb-5 flex items-center gap-2">
          <TrendingUp
            size={18}
            className="text-orange-400"
          />

          <span className="text-sm font-bold tracking-[0.25em] uppercase text-orange-300">
            Weekly Featured
          </span>
        </div>

        <div className="space-y-4">

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-cyan-300" />
              <span className="text-slate-300">
                Views
              </span>
            </div>

            <span className="font-bold text-white">
              187M
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart size={18} className="text-pink-400" />
              <span className="text-slate-300">
                Likes
              </span>
            </div>

            <span className="font-bold text-white">
              2.4M
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe size={18} className="text-emerald-300" />
              <span className="text-slate-300">
                Countries
              </span>
            </div>

            <span className="font-bold text-white">
              42
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}