"use client";

import { useState } from "react";
import { FileCheck2, Loader2 } from "lucide-react";

interface TermsAcceptanceModalProps {
  open: boolean;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
}

export default function TermsAcceptanceModal({
  open,
  onAccept,
  onReject,
}: TermsAcceptanceModalProps) {
  const [pending, setPending] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (choice: "accept" | "reject") => {
    setPending(choice);
    setError(null);
    try {
      await (choice === "accept" ? onAccept() : onReject());
    } catch (err) {
      console.error("Unable to save terms choice:", err);
      setError("We couldn't save your choice. Please try again.");
      setPending(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-orange-400/25 bg-[#08111F] p-5 shadow-[0_25px_90px_rgba(0,0,0,.55)] light:bg-[#F5EEDC] sm:p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300">
          <FileCheck2 size={22} />
        </div>
        <p className="mt-4 text-[10px] font-black uppercase tracking-[.25em] text-orange-300 light:text-orange-700">Welcome to InPlayer</p>
        <h2 className="mt-2 text-2xl font-black text-white light:text-slate-900">Accept the terms to continue</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400 light:text-slate-600">
          Before you use InPlayer, please accept our Terms of Service and Privacy Policy.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" disabled={pending !== null} onClick={() => void run("reject")} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60 light:border-black/10 light:text-slate-700">
            Reject
          </button>
          <button type="button" disabled={pending !== null} onClick={() => void run("accept")} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 px-4 py-3 text-sm font-bold text-slate-900 transition hover:brightness-105 disabled:opacity-60">
            {pending === "accept" ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />} Accept
          </button>
        </div>
        {error && <p className="mt-3 text-center text-xs text-red-300 light:text-red-700">{error}</p>}
      </div>
    </div>
  );
}
