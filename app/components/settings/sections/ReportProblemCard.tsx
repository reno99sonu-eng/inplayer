"use client";

import { useState } from "react";
import { Bug, Loader2, Upload, Check, X } from "lucide-react";
import { authedFetch } from "@/app/lib/apiFetch";
import { compressImageToThumbnail } from "@/app/lib/imageCompress";
import SettingsRow from "../common/SettingsRow";

// Real bug/error report pipeline — every submission lands in
// InPlayer-Bug-Reports and shows up in Admin Panel > Bug Reports for
// triage. Automatically captures the page URL and browser info so the
// admin team doesn't have to ask "what page were you on" every time.
export default function ReportProblemCard() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleScreenshot = async (file: File) => {
    setProcessingImage(true);
    try {
      const dataUrl = await compressImageToThumbnail(file, 16 / 9, 800, 0.75);
      setScreenshotDataUrl(dataUrl);
    } catch (err) {
      console.error("Screenshot processing failed:", err);
    } finally {
      setProcessingImage(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!description.trim()) {
      setError("Please describe what happened.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authedFetch("/api/bug-reports", {
        method: "POST",
        body: JSON.stringify({
          description: description.trim(),
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
          screenshotDataUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't submit your report right now.");
        return;
      }
      setSuccess(true);
      setDescription("");
      setScreenshotDataUrl(null);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 1800);
    } catch (err) {
      console.error("Failed to submit bug report:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SettingsRow
        icon={<Bug size={20} />}
        title="Report a Problem"
        description="Tell us about a bug or something that isn't working."
        onClick={() => setOpen(true)}
      />

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/10 light:border-black/10 bg-[#0B1728] light:bg-white p-5"
          >
            {success ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Check size={28} className="text-emerald-400" />
                <p className="text-sm font-bold text-white light:text-slate-900">Thanks — we got it.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white light:text-slate-900">Report a Problem</p>
                  <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white light:text-slate-600 light:hover:text-slate-900">
                    <X size={16} />
                  </button>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What happened? What did you expect instead?"
                  rows={4}
                  className="mt-3 w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-white px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none focus:border-orange-400/50"
                />
                <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/15 light:border-black/15 px-3 py-2 text-xs text-slate-400 hover:border-orange-400/40">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleScreenshot(file);
                      e.target.value = "";
                    }}
                  />
                  {processingImage ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {screenshotDataUrl ? "Screenshot attached — tap to replace" : "Attach a screenshot (optional)"}
                </label>
                {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Bug size={14} />}
                  {submitting ? "Sending..." : "Send Report"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
