"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Crown, Loader2, Check } from "lucide-react";
import { useAuthModal } from "./auth/AuthProvider";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckoutScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay Checkout.")));
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay Checkout."));
    document.body.appendChild(script);
  });
}

interface MembershipButtonProps {
  creatorId: string;
  creatorName?: string;
}

// The real "Become a Member" button — opens Razorpay's own Checkout popup
// against a live subscription (app/api/memberships/subscribe), price fixed
// at MEMBERSHIP_PRICE_INR/month for every creator. Note this is genuinely
// separate from SubscribeButton's free "In-Family" follow: that's a
// notification relationship, this is real recurring money. A viewer can
// have either, both, or neither.
//
// This component's success handler ONLY shows an optimistic "You're in!"
// state — the actual membership doesn't become real until Razorpay's
// server-to-server webhook lands (app/api/webhooks/razorpay), which is why
// this still re-checks /api/memberships/status after Checkout closes
// instead of trusting its own callback.
export default function MembershipButton({ creatorId, creatorName }: MembershipButtonProps) {
  const { signedIn, user, openSignIn } = useAuthModal();
  const [status, setStatus] = useState<"loading" | "none" | "created" | "active">("loading");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnChannel = signedIn && user?.userId === creatorId;

  useEffect(() => {
    async function load() {
      if (!signedIn) {
        setStatus("none");
        return;
      }
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        const res = await fetch(`/api/memberships/status?creatorId=${creatorId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();
        setStatus(data.isActive ? "active" : data.status === "created" ? "created" : "none");
      } catch (err) {
        console.error("Failed to load membership status:", err);
        setStatus("none");
      }
    }
    load();
  }, [creatorId, signedIn]);

  const handleJoin = async () => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    setError(null);
    setStarting(true);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const [subRes] = await Promise.all([
        fetch("/api/memberships/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ creatorId }),
        }),
        loadCheckoutScript(),
      ]);

      const subData = await subRes.json();
      if (!subRes.ok) {
        setError(subData.error || "Couldn't start membership right now.");
        setStarting(false);
        return;
      }

      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!keyId || !window.Razorpay) {
        setError("Checkout isn't available right now — please try again shortly.");
        setStarting(false);
        return;
      }

      const razorpay = new window.Razorpay({
        key: keyId,
        subscription_id: subData.subscriptionId,
        name: "InPlayer",
        description: creatorName ? `Membership — ${creatorName}` : "InPlayer membership",
        prefill: { email: user?.email, name: user?.name },
        theme: { color: "#FF9A00" },
        handler: async () => {
          // Confirmed here is just "Checkout closed successfully" — the
          // membership itself only becomes real once the webhook credits
          // it, so poll status instead of trusting this callback directly.
          setStatus("created");
          setStarting(false);
          pollForActive(idToken);
        },
        modal: {
          ondismiss: () => setStarting(false),
        },
      });
      razorpay.open();
    } catch (err) {
      console.error("Failed to start membership:", err);
      setError("Couldn't start membership right now.");
      setStarting(false);
    }
  };

  const pollForActive = (idToken: string | undefined) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/memberships/status?creatorId=${creatorId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();
        if (data.isActive) {
          setStatus("active");
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Failed to poll membership status:", err);
      }
      if (attempts >= 10) clearInterval(interval); // ~30s, then give up quietly
    }, 3000);
  };

  if (isOwnChannel || status === "loading") return null;

  if (status === "active") {
    return (
      <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 sm:px-4 sm:py-2 sm:text-sm">
        <Check size={14} /> Member
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleJoin}
        disabled={starting}
        className="
          flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400
          px-3 py-1.5 text-xs font-bold text-white shadow-[0_10px_25px_rgba(255,153,0,.3)]
          transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60
          sm:px-4 sm:py-2 sm:text-sm
        "
      >
        {starting ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />}
        {status === "created" ? "Resume membership" : "Become a Member"}
      </button>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
