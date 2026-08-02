"use client";

import { useEffect } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin Page Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/10">
        <ShieldAlert size={26} className="text-orange-400" />
      </div>
      <h2 className="mt-4 text-2xl font-black text-white light:text-slate-900">
        Admin Panel Error
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-400 light:text-slate-600">
        {error?.message || "Couldn't load this admin section. Click below to reload."}
      </p>
      {error?.digest && (
        <span className="mt-1 text-[10px] font-mono text-slate-500">
          Error Digest: {error.digest}
        </span>
      )}
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <button
          onClick={() => reset()}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-2.5 font-bold text-white shadow-[0_10px_25px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5 cursor-pointer"
        >
          <RefreshCw size={16} />
          Try Again
        </button>
        <button
          onClick={() => (window.location.href = "/admin")}
          className="rounded-2xl border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 light:border-black/10 light:text-slate-800 cursor-pointer"
        >
          Reload Dashboard
        </button>
      </div>
    </div>
  );
}
