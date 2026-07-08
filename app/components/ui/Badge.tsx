

"use client";

import { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  color?: "orange" | "blue" | "green" | "gray";
};

export default function Badge({
  children,
  color = "orange",
}: BadgeProps) {
  const colors = {
    orange:
      "bg-orange-500/10 text-orange-500 border-orange-400/20",

    blue:
      "bg-sky-500/10 text-sky-500 border-sky-400/20",

    green:
      "bg-emerald-500/10 text-emerald-500 border-emerald-400/20",

    gray:
      "bg-slate-200/60 text-slate-700 border-slate-300",
  };

  return (
    <div
      className={`
        inline-flex
        items-center
        rounded-full
        border
        px-4
        py-2
        text-sm
        font-semibold
        backdrop-blur-xl
        ${colors[color]}
      `}
    >
      {children}
    </div>
  );
}