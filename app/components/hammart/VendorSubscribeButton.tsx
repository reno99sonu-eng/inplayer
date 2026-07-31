"use client";

import { useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Loader2, CreditCard } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { VENDOR_SUBSCRIPTION_PRICE_INR } from "@/app/lib/hammartVendors";

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

// The real "subscribe to keep publishing past your 10 free listings"
// button — opens Razorpay's own Checkout against a live subscription
// (app/api/hammart/vendor/subscribe). Mirrors MembershipButton.tsx's shape
// exactly: this component's own handler only shows an optimistic state,
// the subscription doesn't actually go active until the webhook
// (app/api/webhooks/razorpay) confirms a real payment, so this polls
// onActivated's caller to re-check real vendor status after Checkout closes.
export default function VendorSubscribeButton({ onPossiblyActivated }: { onPossiblyActivated: () => void }) {
  const { user } = useAuthModal();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setError(null);
    setStarting(true);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const [subRes] = await Promise.all([
        fetch("/api/hammart/vendor/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        }),
        loadCheckoutScript(),
      ]);

      const subData = await subRes.json();
      if (!subRes.ok) {
        setError(subData.error || "Couldn't start your subscription right now.");
        setStarting(false);
        return;
      }
      if (subData.alreadyActive) {
        onPossiblyActivated();
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
        name: "InPlayer Hammart",
        description: `Vendor subscription — ₹${VENDOR_SUBSCRIPTION_PRICE_INR}/month`,
        prefill: { email: user?.email, name: user?.name },
        theme: { color: "#FF9A00" },
        handler: async () => {
          setStarting(false);
          let attempts = 0;
          const interval = setInterval(async () => {
            attempts += 1;
            onPossiblyActivated();
            if (attempts >= 10) clearInterval(interval);
          }, 3000);
        },
        modal: { ondismiss: () => setStarting(false) },
      });
      razorpay.open();
    } catch (err) {
      console.error("Failed to start vendor subscription:", err);
      setError("Couldn't start your subscription right now.");
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={handleSubscribe}
        disabled={starting}
        className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5 disabled:opacity-60"
      >
        {starting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        Subscribe — ₹{VENDOR_SUBSCRIPTION_PRICE_INR}/month
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
