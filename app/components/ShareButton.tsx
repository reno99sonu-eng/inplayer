"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

interface ShareButtonProps {
  videoId: string;
  title: string;
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
        return;
      } catch {
        // User cancelled the share sheet — not an error, just stop here
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
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
        flex items-center gap-2 rounded-full border border-white/15 light:border-black/15
        px-4 py-2.5 text-sm font-bold text-slate-200 light:text-slate-700
        transition-all duration-300 hover:bg-white/5 light:hover:bg-black/5
      "
    >
      {copied ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
      <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
    </button>
  );
}
