"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { useAuthModal } from "./auth/AuthProvider";

interface SubscribeButtonProps {
  creatorId: string;
}

export default function SubscribeButton({ creatorId }: SubscribeButtonProps) {
  const { signedIn, user, openSignIn } = useAuthModal();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const isOwnChannel = signedIn && user?.userId === creatorId;

  useEffect(() => {
    async function load() {
      try {
        let headers: HeadersInit = {};

        if (signedIn) {
          const session = await fetchAuthSession();
          const idToken = session.tokens?.idToken?.toString();
          if (idToken) headers = { Authorization: `Bearer ${idToken}` };
        }

        const res = await fetch(`/api/subscriptions?creatorId=${creatorId}`, {
          headers,
        });
        const data = await res.json();
        setIsSubscribed(data.isSubscribed);
        setCount(data.subscriberCount);
      } catch (err) {
        console.error("Failed to load subscription status:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [creatorId, signedIn]);

  const handleToggle = async () => {
    if (!signedIn) {
      openSignIn();
      return;
    }

    setUpdating(true);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const action = isSubscribed ? "unsubscribe" : "subscribe";

      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ creatorId, action }),
      });

      if (res.ok) {
        setIsSubscribed(!isSubscribed);
        setCount((c) => c + (isSubscribed ? -1 : 1));
      }
    } catch (err) {
      console.error("Failed to toggle subscription:", err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-9 w-28 animate-pulse rounded-full bg-white/10 light:bg-black/5" />
    );
  }

  if (isOwnChannel) {
    return (
      <span className="rounded-full border border-white/10 light:border-black/10 px-3 py-2 text-xs font-semibold text-slate-500">
        This is you
      </span>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={updating}
      className={`
        flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold
        transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60
        ${
          isSubscribed
            ? "border border-white/15 light:border-black/15 text-slate-200 light:text-slate-700 hover:bg-white/5 light:hover:bg-black/5"
            : "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-[0_10px_25px_rgba(255,153,0,.3)] hover:-translate-y-0.5"
        }
      `}
    >
      {isSubscribed ? "Subscribed" : "Subscribe"}
      <span className="text-xs opacity-75">{count}</span>
    </button>
  );
}
