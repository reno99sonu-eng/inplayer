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
        flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold
        transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60
        ${
          saved
            ? "border-orange-400/50 bg-orange-500/10 text-orange-300 light:text-orange-700"
            : "border-white/15 light:border-black/15 text-slate-200 light:text-slate-700 hover:bg-white/5 light:hover:bg-black/5"
        }
      `}
    >
      {saved ? <Check size={16} /> : <Clock size={16} />}
      <span className="hidden sm:inline">{saved ? "Saved" : "Watch Later"}</span>
    </button>
  );
}
