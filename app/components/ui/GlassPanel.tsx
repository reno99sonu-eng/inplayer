"use client";

import { ReactNode } from "react";

type GlassPanelProps = {
  children: ReactNode;
  className?: string;
};

export default function GlassPanel({
  children,
  className = "",
}: GlassPanelProps) {
  return (
    <div
      className={`
        rounded-[32px]
        border
        border-white/20
        bg-white/10
        backdrop-blur-2xl
        shadow-[0_25px_60px_rgba(15,23,42,0.18)]
        transition-all
        duration-500
        hover:shadow-[0_35px_80px_rgba(15,23,42,0.28)]
        ${className}
      `}
    >
      {children}
    </div>
  );
}