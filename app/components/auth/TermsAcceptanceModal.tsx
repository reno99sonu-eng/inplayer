"use client";

import { useEffect, useState } from "react";
import { FileCheck2, Loader2, ExternalLink } from "lucide-react";

interface TermsAcceptanceModalProps {
  open: boolean;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
}

// The parent (AuthProvider) now always renders this component and just
// flips `open` — it used to conditionally mount/unmount it instead, which
// yanked the modal out of the tree the instant terms were accepted, with
// no time for any exit transition to play. `mounted`/`visible` here are
// what actually let "the pop up fades away" happen: stay mounted for one
// more transition duration after `open` goes false, and drive opacity off
// a delayed `visible` flag rather than `open` directly.
export default function TermsAcceptanceModal({
  open,
  onAccept,
  onReject,
}: TermsAcceptanceModalProps) {
  const [pending, setPending] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return (() => {
      if (open) {
        setMounted(true);
        const raf = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(raf);
      }
      setVisible(false);
      const timeout = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(timeout);
    })();
  }, [open]);

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

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`w-full max-w-md rounded-3xl border border-orange-400/25 bg-[#08111F] p-5 shadow-[0_25px_90px_rgba(0,0,0,.55)] light:bg-[#F5EEDC] sm:p-6 transition-all duration-200 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
        }`}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300">
          <FileCheck2 size={22} />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="rounded-full bg-orange-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-400">
            Policy Update • Sept 5, 2026
          </span>
        </div>
        <h2 className="mt-2 text-2xl font-black text-white light:text-slate-900">Terms & Policies Update</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300 light:text-slate-700">
          To continue using InPlayer, please review and accept our updated platform terms and policies (Version 2026-09-05):
        </p>

        <ul className="mt-3 space-y-1.5 text-xs text-slate-400 light:text-slate-600">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-orange-300 light:text-orange-600 hover:underline inline-flex items-center gap-1"
            >
              Terms & Conditions <ExternalLink size={11} />
            </a>
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-orange-300 light:text-orange-600 hover:underline inline-flex items-center gap-1"
            >
              Privacy Policy (DPDPA 2023) <ExternalLink size={11} />
            </a>
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            <a
              href="/community-guidelines"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-orange-300 light:text-orange-600 hover:underline inline-flex items-center gap-1"
            >
              Community Guidelines <ExternalLink size={11} />
            </a>
          </li>
        </ul>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void run("reject")}
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60 light:border-black/10 light:text-slate-700"
          >
            Decline
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void run("accept")}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 px-4 py-3 text-sm font-bold text-slate-900 transition hover:brightness-105 disabled:opacity-60"
          >
            {pending === "accept" ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />} Accept
          </button>
        </div>
        {error && <p className="mt-3 text-center text-xs text-red-300 light:text-red-700">{error}</p>}
      </div>
    </div>
  );
}
