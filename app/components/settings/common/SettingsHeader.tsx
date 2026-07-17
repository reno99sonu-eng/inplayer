"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsHeader() {
  const router = useRouter();

  return (
    <header className="relative overflow-hidden border-b border-white/10">
      {/* Background Text */}
      <h1
        className="
          pointer-events-none
          absolute
          left-4
          top-2
          select-none
          text-[90px]
          font-black
          tracking-[-0.08em]
          text-white/[0.025]
          lg:left-8
          lg:text-[150px]
        "
      >
        SETTINGS
      </h1>

      <div className="relative z-10 flex items-center gap-4 px-5 py-6">
        <button
          onClick={() => router.back()}
          className="
            flex
            h-11
            w-11
            items-center
            justify-center
            rounded-full
            border
            border-white/10
            bg-white/5
            transition-all
            duration-300
            hover:border-orange-400/40
            hover:bg-white/10
            hover:scale-105
          "
        >
          <ArrowLeft size={20} />
        </button>

        <div>
          <h1
            className="
              text-3xl
              font-black
              tracking-[-0.03em]
              text-white
            "
          >
            Settings
          </h1>

          <p className="mt-1 text-sm text-slate-400">
            Personalize your InPlayer experience.
          </p>
        </div>
      </div>
    </header>
  );
}