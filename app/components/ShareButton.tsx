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
        flex h-9 w-9 items-center justify-center rounded-full
        border border-white/10 light:border-black/10
        bg-white/[0.03] light:bg-black/[0.02]
        text-slate-300 light:text-slate-600
        transition-all duration-300
        hover:border-white/20 light:hover:border-black/20 hover:bg-white/[0.06]

        lg:h-11 lg:w-11
      "
    >
      {copied ? <Check size={18} className="text-emerald-400" /> : <Share2 size={18} />}
    </button>
  );
}
