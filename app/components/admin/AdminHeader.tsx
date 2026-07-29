"use client";

import { ShieldCheck } from "lucide-react";

export default function AdminHeader({ email }: { email: string | null }) {
  return (
    <header className="relative overflow-hidden border-b border-white/10 light:border-black/10">
      <h1
        className="
          pointer-events-none
          absolute
          left-4
          top-2
          select-none
          text-[80px]
          font-black
          tracking-[-0.08em]
          text-white/[0.025] light:text-black/[0.04]
          lg:left-8
          lg:text-[140px]
        "
      >
        ADMIN
      </h1>

      <div className="relative z-10 flex items-center gap-4 px-5 py-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-orange-400/30 bg-orange-500/10">
          <ShieldCheck size={20} className="text-orange-300" />
        </div>

        <div>
          <h1 className="text-3xl font-black tracking-[-0.03em] text-white light:text-slate-900">
            Admin Panel
          </h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
            {email ? `Signed in as ${email}` : "Real InPlayer data — no dummy numbers."}
          </p>
        </div>
      </div>
    </header>
  );
}
