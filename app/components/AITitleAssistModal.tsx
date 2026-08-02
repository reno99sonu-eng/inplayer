"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";

interface AITitleAssistModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fills the textarea from whatever's already in the Description
      field, if anything, so the creator isn't forced to retype context
      that already exists. */
  initialDescription?: string;
  generating: boolean;
  error: string | null;
  suggestions: string[];
  onGenerate: (description: string) => void;
  onPick: (title: string) => void;
}

// The AI can't watch the uploaded video — the only signal it ever had
// before this was the raw filename and whatever category was picked,
// which is exactly why "Generate AI Title" produced near-random results.
// This popup asks the creator directly what the video is actually about
// and feeds that in as real context (see userDescription in aiPrompts.ts),
// then lets them pick from the results instead of one getting applied
// silently.
export default function AITitleAssistModal({
  open,
  onClose,
  initialDescription = "",
  generating,
  error,
  suggestions,
  onGenerate,
  onPick,
}: AITitleAssistModalProps) {
  const [description, setDescription] = useState(initialDescription);

  // Reseed the textarea from the latest Description field content each
  // time the popup opens, without clobbering what the creator is typing
  // while it's already open.
  useEffect(() => {
    if (open) setDescription(initialDescription);
  }, [open, initialDescription]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-orange-400/25 bg-[#08111F] p-4 shadow-[0_25px_90px_rgba(0,0,0,.55)] light:bg-[#F5EEDC] sm:p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300">
            <Sparkles size={20} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white light:hover:bg-black/5 light:hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </div>

        <h2 className="mt-3 text-xl font-black text-white light:text-slate-900">
          Generate a title with AI
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400 light:text-slate-600">
          The AI can&apos;t watch your video, so tell it what happens in a
          sentence or two — the more specific you are, the better the title
          options.
        </p>

        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. A 3-minute tutorial showing how to fix a leaking kitchen tap with basic tools"
          className="mt-4 w-full resize-none rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] px-4 py-3 text-sm text-white light:text-slate-900 caret-orange-400 outline-none focus:border-orange-400/50"
        />

        <button
          type="button"
          disabled={generating || !description.trim()}
          onClick={() => onGenerate(description)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 py-3 text-sm font-bold text-slate-900 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {generating ? "Generating titles..." : "Generate titles"}
        </button>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        {suggestions.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-400 light:text-slate-600">
              Pick one
            </p>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onPick(s)}
                className="block w-full rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] px-4 py-3 text-left text-sm font-semibold text-white light:text-slate-900 transition hover:border-orange-400/40 hover:bg-orange-500/10"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
