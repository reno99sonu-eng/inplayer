"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useAuthModal } from "./auth/AuthProvider";

interface LikeButtonProps {
  videoId: string;
}

export default function LikeButton({ videoId }: LikeButtonProps) {
  const { signedIn, openSignIn } = useAuthModal();
  const [myReaction, setMyReaction] = useState<"like" | "dislike" | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);
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

        const res = await fetch(`/api/likes?videoId=${videoId}`, { headers });
        const data = await res.json();
        setMyReaction(data.myReaction);
        setLikeCount(data.likeCount);
        setDislikeCount(data.dislikeCount);
      } catch (err) {
        console.error("Failed to load reaction status:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [videoId, signedIn]);

  const handleReact = async (reaction: "like" | "dislike") => {
    if (!signedIn) {
      openSignIn();
      return;
    }

    setUpdating(true);

    // Clicking the reaction you already have removes it; clicking the
    // other one switches to it.
    const nextReaction = myReaction === reaction ? null : reaction;
    const previousReaction = myReaction;

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch("/api/likes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          videoId,
          action: nextReaction || "remove",
        }),
      });

      if (res.ok) {
        setMyReaction(nextReaction);

        // Update counts locally to match: remove the old reaction's
        // count (if any), add the new one's count (if any).
        if (previousReaction === "like") setLikeCount((c) => c - 1);
        if (previousReaction === "dislike") setDislikeCount((c) => c - 1);
        if (nextReaction === "like") setLikeCount((c) => c + 1);
        if (nextReaction === "dislike") setDislikeCount((c) => c + 1);
      }
    } catch (err) {
      console.error("Failed to update reaction:", err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-11 w-32 animate-pulse rounded-full bg-white/10 light:bg-black/5" />
    );
  }

  return (
    <div className="flex items-center overflow-hidden rounded-full border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02]">
      <button
        onClick={() => handleReact("like")}
        disabled={updating}
        className={`
          flex items-center gap-2 px-4 py-2.5 h-11 text-sm font-bold
          transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60
          ${
            myReaction === "like"
              ? "bg-gradient-to-br from-orange-500/25 to-amber-400/10 text-orange-300 light:text-orange-700 shadow-[inset_0_0_20px_-8px_rgba(249,115,22,.5)]"
              : "text-slate-200 light:text-slate-700 hover:bg-white/5 light:hover:bg-black/5"
          }
        `}
      >
        <ThumbsUp size={17} className={myReaction === "like" ? "fill-current" : ""} />
        {likeCount}
      </button>

      <div className="h-6 w-px bg-white/10 light:bg-black/10" />

      <button
        onClick={() => handleReact("dislike")}
        disabled={updating}
        className={`
          flex items-center gap-2 px-4 py-2.5 h-11 text-sm font-bold
          transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60
          ${
            myReaction === "dislike"
              ? "bg-gradient-to-br from-red-500/25 to-rose-400/10 text-red-300 light:text-red-700 shadow-[inset_0_0_20px_-8px_rgba(239,68,68,.5)]"
              : "text-slate-200 light:text-slate-700 hover:bg-white/5 light:hover:bg-black/5"
          }
        `}
      >
        <ThumbsDown size={17} className={myReaction === "dislike" ? "fill-current" : ""} />
        {dislikeCount}
      </button>
    </div>
  );
}
