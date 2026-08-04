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
          absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl
          bg-gradient-to-br from-orange-500/20 to-amber-400/10
          text-orange-400
          transition-transform duration-300 group-hover:scale-110
        "
      >
        <Icon size={16} />
      </div>

      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 light:text-slate-600">
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
