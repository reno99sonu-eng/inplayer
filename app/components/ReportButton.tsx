"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import { Flag, X, Loader2, Check } from "lucide-react";
import { REPORT_REASONS } from "@/app/lib/reportReasons";
import { useAuthModal } from "@/app/components/auth/AuthProvider";

type ReportTarget =
  | { targetType: "comment"; videoId: string; commentId: string }
  | { targetType: "message"; conversationId: string; messageId: string }
  | { targetType: "video"; videoId: string };

// The YouTube-style "Report" affordance for comments and direct messages —
// app/components/watch/VideoOptionsMenu.tsx has its own larger built-in
// report panel for videos (left untouched); this is the same real
// app/api/reports backend, just as a small standalone icon+modal for
// content that doesn't have a whole options menu of its own.
export default function ReportButton({
  target,
  className,
}: {
  target: ReportTarget;
  className?: string;
}) {
  const { signedIn, openSignIn } = useAuthModal();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const close = () => {
    setOpen(false);
    setReason(null);
    setDetails("");
    setSubmitted(false);
  };

  const handleOpen = () => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    setOpen(true);
  };

  const submit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken && { Authorization: `Bearer ${idToken}` }),
        },
        body: JSON.stringify({ ...target, reason, details }),
      });
      if (res.ok) {
        setSubmitted(true);
        setTimeout(close, 1400);
      }
    } catch (err) {
      console.error("Failed to submit report:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Report"
        title="Report"
        className={className || "text-slate-500 transition hover:text-red-400"}
      >
        <Flag size={13} />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onClick={close}
            className="fixed inset-0 z-[9990] flex items-end justify-center bg-black/50 p-4 pb-24 backdrop-blur-[2px] sm:items-center sm:pb-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[380px] rounded-2xl border border-white/10 light:border-black/10 bg-[#0A1424] light:bg-[#FBF6EA] p-3 shadow-[0_25px_70px_-20px_rgba(0,0,0,.6)]"
            >
              <div className="mb-1 flex items-center justify-between px-1 pb-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 light:text-slate-600">
                  Report this {target.targetType === "comment" ? "comment" : target.targetType === "message" ? "message" : "video"}
                </p>
                <button
                  onClick={close}
                  aria-label="Close"
                  className="text-slate-400 transition hover:text-white light:hover:text-slate-900"
                >
                  <X size={15} />
                </button>
              </div>

              {submitted ? (
                <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                  <Check size={28} className="text-emerald-400" />
                  <p className="text-sm font-semibold text-white light:text-slate-900">
                    Thanks — we&apos;ll review this.
                  </p>
                </div>
              ) : (
                <>
                  <div className="max-h-52 space-y-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {REPORT_REASONS.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => setReason(r.value)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 light:text-slate-800 transition hover:bg-white/5 light:hover:bg-black/5"
                      >
                        <span
                          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                            reason === r.value
                              ? "border-orange-400 bg-orange-500"
                              : "border-white/25 light:border-black/25"
                          }`}
                        >
                          {reason === r.value && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="truncate">{r.label}</span>
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={2}
                    placeholder="Add details (optional)"
                    className="mt-2 w-full resize-none rounded-xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] px-3 py-2 text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500 focus:border-orange-400/50"
                  />

                  <button
                    onClick={submit}
                    disabled={!reason || submitting}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : <Flag size={15} />}
                    Submit report
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
