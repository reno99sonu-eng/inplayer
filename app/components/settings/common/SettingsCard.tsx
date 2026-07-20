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
        border-white/10
        bg-white/[0.03]
        backdrop-blur-xl
        transition-all
        duration-500
        ease-out
        hover:border-white/20
        hover:shadow-[0_0_50px_rgba(255,255,255,.04)]
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
              bg-white/[0.06]
              text-white
              ring-1
              ring-white/10
            "
          >
            {icon}
          </div>

          <div>
            <h2 className="text-xl font-black tracking-[-0.02em] text-white">
              {title}
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              {description}
            </p>
          </div>

        </div>

        {children}

      </div>
    </section>
  );
}
