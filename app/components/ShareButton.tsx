"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

interface ShareButtonProps {
  videoId: string;
  title: string;
}

// Fire-and-forget: tallies the share for the creator's analytics. Never
// blocks or surfaces an error to the person sharing — the share sheet/copy
// already succeeded for them by the time this runs.
export function recordShare(videoId: string) {
  fetch(`/api/videos/${videoId}/share`, { method: "POST" }).catch(() => {});
}

export default function ShareButton({ videoId, title }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/watch/${videoId}`;

    // Use the native share sheet on devices that support it (mobile,
    // and some desktop browsers); fall back to copying the link.
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        recordShare(videoId);
        return;
      } catch {
        // User cancelled the share sheet — not an error, just stop here
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      recordShare(videoId);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  return (
    <button
      onClick={handleShare}
      title="Share"
      className="
        flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full
        border border-white/10 light:border-black/10
        bg-white/[0.03] light:bg-black/[0.02]
        text-slate-300 light:text-slate-600
        transition-all duration-300
        hover:border-white/20 light:hover:border-black/20 hover:bg-white/[0.06]

        sm:h-9 sm:w-9
      "
    >
      {copied ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
    </button>
  );
}
