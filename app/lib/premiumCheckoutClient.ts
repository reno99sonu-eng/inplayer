"use client";

import { loadRazorpayCheckoutScript } from "@/app/lib/sponsorshipCheckoutClient";

// Client-side Razorpay Checkout for InPlayer Premium.
//
// Deliberately IMPORTS loadRazorpayCheckoutScript rather than making a third
// copy of it. Hammart and sponsorships each carry their own copy because
// they were built at different times and are otherwise unrelated; there is
// no reason to repeat that. The script loader is feature-agnostic — it just
// injects checkout.js once and resolves — so the sponsorship one is reused
// as-is. window.Razorpay's type comes from hammartCheckoutClient.ts's
// `declare global` block, which TypeScript merges project-wide.
export { loadRazorpayCheckoutScript };

// Resolves "submitted" the moment Checkout's own handler fires — that means
// the GATEWAY accepted the payment, NOT that Premium is active. Premium is
// granted only by app/api/webhooks/razorpay/route.ts on the signed
// payment.captured event, which is why the caller always polls afterwards
// rather than trusting this. Same convention as openSponsorshipCheckout.
export function openPremiumCheckout(params: {
  razorpayOrderId: string;
  razorpayKeyId: string;
  planLabel: string;
  name?: string;
  email?: string;
}): Promise<"submitted" | "dismissed" | "unavailable"> {
  return new Promise((resolve) => {
    if (!params.razorpayKeyId || !params.razorpayOrderId || !window.Razorpay) {
      resolve("unavailable");
      return;
    }
    const razorpay = new window.Razorpay({
      key: params.razorpayKeyId,
      order_id: params.razorpayOrderId,
      name: "InPlayer Premium",
      description: `${params.planLabel} membership`,
      prefill: {
        ...(params.name ? { name: params.name } : {}),
        ...(params.email ? { email: params.email } : {}),
      },
      theme: { color: "#FF9A00" },
      handler: () => resolve("submitted"),
      modal: {
        ondismiss: () => resolve("dismissed"),
      },
    });
    razorpay.open();
  });
}

// Polls GET /api/premium/me until the account actually reads as Premium —
// i.e. until the webhook has landed and written premiumUntil. Same shape as
// pollSponsorshipPaymentStatus: "pending" after the window is not a failure,
// just a slow webhook, and the Plans card says so rather than claiming the
// payment failed.
export async function pollPremiumActivation(params: {
  authedFetch: (url: string, init?: RequestInit) => Promise<Response>;
  maxAttempts?: number;
  intervalMs?: number;
}): Promise<"active" | "pending"> {
  const maxAttempts = params.maxAttempts ?? 12;
  const intervalMs = params.intervalMs ?? 3000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const res = await params.authedFetch("/api/premium/me");
      const data = await res.json().catch(() => ({}));
      if (data?.premium === true) return "active";
    } catch (err) {
      console.error("Failed to poll Premium activation:", err);
    }
  }
  return "pending";
}
