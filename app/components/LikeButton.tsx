"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { ThumbsUp } from "lucide-react";
import { useAuthModal } from "./auth/AuthProvider";

interface LikeButtonProps {
  videoId: string;
}

export default function LikeButton({ videoId }: LikeButtonProps) {
  const { signedIn, openSignIn } = useAuthModal();
  const [isLiked, setIsLiked] = useState(false);
  const [count, setCount] = useState(0);
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
        setIsLiked(data.isLiked);
        setCount(data.likeCount);
      } catch (err) {
        console.error("Failed to load like status:", err);
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
      const action = isLiked ? "unlike" : "like";

      const res = await fetch("/api/likes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ videoId, action }),
      });

      if (res.ok) {
        setIsLiked(!isLiked);
        setCount((c) => c + (isLiked ? -1 : 1));
      }
    } catch (err) {
      console.error("Failed to toggle like:", err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-11 w-24 animate-pulse rounded-full bg-white/10 light:bg-black/5" />
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={updating}
      className={`
        flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold
        transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60
        ${
          isLiked
            ? "border-orange-400/50 bg-orange-500/10 text-orange-300 light:text-orange-700"
            : "border-white/15 light:border-black/15 text-slate-200 light:text-slate-700 hover:bg-white/5 light:hover:bg-black/5"
        }
      `}
    >
      <ThumbsUp size={16} className={isLiked ? "fill-current" : ""} />
      {count}
    </button>
  );
}
