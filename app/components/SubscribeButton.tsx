"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Bell, BellOff, Check } from "lucide-react";
import { useAuthModal } from "./auth/AuthProvider";

interface SubscribeButtonProps {
  creatorId: string;
}

// "In-Family" is InPlayer's name for what other platforms call Subscribe.
// Once joined, a notification bell appears (YouTube-style) that toggles
// whether this viewer gets notified about the creator's new uploads.
export default function SubscribeButton({ creatorId }: SubscribeButtonProps) {
  const { signedIn, user, openSignIn } = useAuthModal();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [count, setCount] = useState(0);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notifyUpdating, setNotifyUpdating] = useState(false);

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
        setNotifyEnabled(data.notifyEnabled !== false);
      } catch (err) {
        console.error("Failed to load In-Family status:", err);
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
        const nowSubscribed = !isSubscribed;
        setIsSubscribed(nowSubscribed);
        setCount((c) => c + (isSubscribed ? -1 : 1));
        // Joining opts you back into notifications by default.
        if (nowSubscribed) setNotifyEnabled(true);
      }
    } catch (err) {
      console.error("Failed to toggle In-Family:", err);
    } finally {
      setUpdating(false);
    }
  };

  const handleNotifyToggle = async () => {
    if (!signedIn || notifyUpdating) return;

    const next = !notifyEnabled;
    setNotifyEnabled(next); // optimistic
    setNotifyUpdating(true);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ creatorId, action: "notify", notifyEnabled: next }),
      });

      if (!res.ok) setNotifyEnabled(!next); // revert on failure
    } catch (err) {
      console.error("Failed to toggle notifications:", err);
      setNotifyEnabled(!next); // revert
    } finally {
      setNotifyUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-8 w-20 animate-pulse rounded-full bg-white/10 light:bg-black/5 sm:h-9 sm:w-28" />
    );
  }

  if (isOwnChannel) {
    return (
      <span className="rounded-full border border-white/10 light:border-black/15 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 light:text-slate-600 sm:px-3 sm:py-2 sm:text-xs">
        This is you
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <button
        onClick={handleToggle}
        disabled={updating}
        className={`
          flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold
          transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60

          sm:gap-1.5 sm:px-4 sm:py-2 sm:text-sm
          ${
            isSubscribed
              ? "border border-white/15 light:border-black/20 text-slate-200 light:text-slate-800 hover:bg-white/5 light:hover:bg-black/5"
              : "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-[0_10px_25px_rgba(255,153,0,.3)] hover:-translate-y-0.5"
          }
        `}
      >
        {isSubscribed && <Check size={14} />}
        In-Family
        {/* Zero is the common case for a freshly published video — same
            reasoning as LikeButton's counts: hide it, only show once
            there's an actual number worth seeing. */}
        {count > 0 && <span className="text-[10px] opacity-75 sm:text-xs">{count}</span>}
      </button>

      {/* Notification bell — only meaningful once you've joined. */}
      {isSubscribed && (
        <button
          onClick={handleNotifyToggle}
          disabled={notifyUpdating}
          title={
            notifyEnabled
              ? "Notifications on — tap to turn off"
              : "Notifications off — tap to turn on"
          }
          aria-label={
            notifyEnabled ? "Turn off notifications" : "Turn on notifications"
          }
          className={`
            flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border
            transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60

            sm:h-9 sm:w-9
            ${
              notifyEnabled
                ? "border-orange-400/50 bg-gradient-to-br from-orange-500/20 to-amber-400/10 text-orange-300 light:text-orange-700"
                : "border-white/10 light:border-black/15 bg-white/[0.03] light:bg-black/[0.03] text-slate-400 light:text-slate-600 hover:border-white/20 light:hover:border-black/25"
            }
          `}
        >
          {notifyEnabled ? (
            <Bell size={15} className="fill-current" />
          ) : (
            <BellOff size={15} />
          )}
        </button>
      )}
    </div>
  );
}
