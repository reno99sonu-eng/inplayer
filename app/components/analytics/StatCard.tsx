"use client";

import type { LucideIcon } from "lucide-react";

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div
      className="
        group relative overflow-hidden rounded-2xl border border-white/10 light:border-black/10
        bg-white/[0.02] light:bg-black/[0.015]
        p-4
        transition-all duration-300
        hover:border-orange-400/30 hover:bg-white/[0.04] light:hover:bg-black/[0.03]
      "
    >
      <div
        className="
          absolute -right-4 -top-4 flex h-16 w-16 items-center justify-center rounded-2xl
          bg-gradient-to-br from-orange-500/15 to-amber-400/5
          text-orange-400/40
          transition-transform duration-300 group-hover:scale-110
        "
      >
        <Icon size={22} className="mb-6 ml-1" />
      </div>

      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 light:text-slate-500">
        {label}
      </p>
      <p
        className="mt-1.5 text-2xl font-black text-white light:text-slate-900"
        title={value.toLocaleString()}
      >
        {formatCompact(value)}
      </p>
    </div>
  );
}
