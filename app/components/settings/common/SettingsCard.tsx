"use client";

import { ReactNode } from "react";

interface SettingsCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}

export default function SettingsCard({
  icon,
  title,
  description,
  children,
}: SettingsCardProps) {
  return (
    <section
      className="
        relative
        overflow-hidden
        rounded-[30px]
        border
        border-white/10 light:border-black/10
        bg-white/[0.035] light:bg-black/[0.035]
        backdrop-blur-xl
        transition-all
        duration-300
        hover:border-orange-400/30
        hover:shadow-[0_0_40px_rgba(249,115,22,.12)]
      "
    >
      <div className="p-6">

        <div className="mb-6 flex items-start gap-4">

          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-2xl
              bg-gradient-to-br
              from-orange-500/20
              to-amber-400/20
              text-orange-300
              ring-1
              ring-orange-400/20
            "
          >
            {icon}
          </div>

          <div>
            <h2 className="text-xl font-black tracking-[-0.02em] text-white light:text-slate-900">
              {title}
            </h2>

            <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
              {description}
            </p>
          </div>

        </div>

        {children}

      </div>
    </section>
  );
}