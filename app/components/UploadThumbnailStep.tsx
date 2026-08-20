"use client";

import { useMemo, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { getMuxThumbnailCandidates } from "@/app/lib/muxThumbnail";

interface UploadThumbnailStepProps {
  videoId: string;
  muxPlaybackId: string | null;
  duration: number;
  defaultThumbnailUrl: string | null;
  onDone: () => void;
  contentType?: "video" | "short" | "music";
}

export default function UploadThumbnailStep({
  videoId,
  muxPlaybackId,
  duration,
  defaultThumbnailUrl,
  contentType,
  onDone,
}: UploadThumbnailStepProps) {
  const candidates = useMemo(
    () => (muxPlaybackId && contentType !== "music" ? getMuxThumbnailCandidates(muxPlaybackId, duration, 5) : []),
    [muxPlaybackId, duration, contentType]
  );
  const [selected, setSelected] = useState<string | null>(defaultThumbnailUrl);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    // Nothing changed from what Mux/upload already set — nothing to persist.
    if (!selected || selected === defaultThumbnailUrl) {
      onDone();
      return;
    }

    setSaving(true);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      if (idToken) {
        await fetch(`/api/my-videos/${videoId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ thumbnailUrl: selected }),
        });
      }
    } catch (err) {
      console.error("Failed to save chosen thumbnail:", err);
      // Non-fatal — Mux's auto-generated thumbnail is still live either way,
      // and the video is fully published regardless.
    } finally {
      setSaving(false);
      onDone();
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15">
        <CheckCircle2 size={30} className="text-emerald-400" />
      </div>
      <div>
        <p className="font-semibold text-white light:text-slate-900">
          Your {contentType === "music" ? "audio track" : "video"} is ready!
        </p>
        {contentType !== "music" && (
          <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
            Pick a thumbnail, or keep the one we picked automatically.
          </p>
        )}
      </div>

      {candidates.length > 0 && contentType !== "music" && (
        <div className="w-full max-w-md space-y-3 text-left">
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
            {candidates.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => setSelected(url)}
                className={`overflow-hidden rounded-xl border transition-all ${
                  selected === url
                    ? "border-orange-500 ring-2 ring-orange-500"
                    : "border-white/10 hover:border-orange-400/50"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- external Mux image host, next/image isn't worth configuring for a transient picker. */}
                <img src={url} alt="Thumbnail option" className="aspect-video w-full object-contain bg-black/20" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex w-full max-w-md gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] py-3 text-sm font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5 disabled:opacity-70"
        >
          {saving ? "Saving..." : "Continue to your video"}
        </button>
      </div>
    </div>
  );
}
