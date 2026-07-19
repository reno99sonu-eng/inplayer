"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Clock, Check } from "lucide-react";
import { useAuthModal } from "./auth/AuthProvider";

interface WatchLaterButtonProps {
  videoId: string;
}

export default function WatchLaterButton({ videoId }: WatchLaterButtonProps) {
  const { signedIn, openSignIn } = useAuthModal();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        let headers: HeadersInit = {};

        if (signedIn) {
          const session = await fetchAuthSession();
          const idToken = session.tokens?.idToken?.toString();
          if (idToken) headers = { Authorization: `Bearer ${idToken}` };
        }

        const res = await fetch(`/api/watchlist?videoId=${videoId}`, { headers });
        const data = await res.json();
        setSaved(data.inWatchlist);
      } catch (err) {
        console.error("Failed to load watch later status:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [videoId, signedIn]);

  const handleToggle = async () => {
    if (!signedIn) {
      openSignIn();
      return;
    }

    setUpdating(true);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const action = saved ? "remove" : "add";

      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ videoId, action }),
      });

      if (res.ok) {
        setSaved(!saved);
      }
    } catch (err) {
      console.error("Failed to toggle watch later:", err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-11 w-11 animate-pulse rounded-full bg-white/10 light:bg-black/5" />
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={updating}
      title={saved ? "Remove from Watch Later" : "Save to Watch Later"}
      className={`
        group relative flex h-11 w-11 items-center justify-center rounded-full
        border transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60
        ${
          saved
            ? "border-orange-400/50 bg-gradient-to-br from-orange-500/20 to-amber-400/10 text-orange-300 light:text-orange-700 shadow-[0_0_20px_-5px_rgba(249,115,22,.4)]"
            : "border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] text-slate-300 light:text-slate-600 hover:border-white/20 light:hover:border-black/20 hover:bg-white/[0.06]"
        }
      `}
    >
      {saved ? <Check size={18} /> : <Clock size={18} />}
    </button>
  );
}
