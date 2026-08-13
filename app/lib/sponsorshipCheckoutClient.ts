"use client";

// Client-side Razorpay Checkout orchestration for the ad-sponsorship
// feature (app/sponsorships/page.tsx) — same loadRazorpayCheckoutScript
// pattern as app/lib/hammartCheckoutClient.ts (kept as its own small copy
// rather than importing from that Hammart-named file, since this feature
// is otherwise unrelated to Hammart). window.Razorpay's type is already
// declared globally by hammartCheckoutClient.ts's `declare global` block —
// TypeScript merges that across the whole project, so it doesn't need to
// be redeclared here.
//
// Same convention as openHammartCheckoutForGroup: this only resolves
// "submitted" the instant Checkout's own handler fires (payment accepted
// by the gateway) — it is NOT proof the order is actually paid. That only
// happens once app/api/webhooks/razorpay/route.ts's payment.captured
// handler runs, which is why the caller (app/sponsorships/page.tsx) always
// polls GET /api/sponsorships/[sponsorshipId] afterward rather than
// trusting this resolution as final.

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export function loadRazorpayCheckoutScript(): Promise<void> {
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

export function openSponsorshipCheckout(params: {
  razorpayOrderId: string;
  razorpayKeyId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}): Promise<"submitted" | "dismissed" | "unavailable"> {
  return new Promise((resolve) => {
    if (!params.razorpayKeyId || !params.razorpayOrderId || !window.Razorpay) {
      resolve("unavailable");
      return;
    }
    const razorpay = new window.Razorpay({
      key: params.razorpayKeyId,
      order_id: params.razorpayOrderId,
      name: "InPlayer Ad Sponsorship",
      description: "7-day ad placement on InPlayer",
      prefill: { name: params.contactName, email: params.contactEmail, contact: params.contactPhone },
      theme: { color: "#FF9A00" },
      handler: () => resolve("submitted"),
      modal: {
        ondismiss: () => resolve("dismissed"),
      },
    });
    razorpay.open();
  });
}

// Polls GET /api/sponsorships/[sponsorshipId] until paymentStatus leaves
// "pending", same "poll the real order until the webhook has caught up"
// shape as pollHammartOrderStatuses in hammartCheckoutClient.ts.
export async function pollSponsorshipPaymentStatus(params: {
  authedFetch: (url: string, init?: RequestInit) => Promise<Response>;
  sponsorshipId: string;
  maxAttempts?: number;
  intervalMs?: number;
}): Promise<"paid" | "failed" | "pending"> {
  const maxAttempts = params.maxAttempts ?? 12;
  const intervalMs = params.intervalMs ?? 3000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const res = await params.authedFetch(`/api/sponsorships/${params.sponsorshipId}`);
      const data = await res.json().catch(() => ({}));
      const status = data?.sponsorship?.paymentStatus;
      if (status === "paid" || status === "failed") return status;
    } catch (err) {
      console.error("Failed to poll sponsorship payment status:", err);
    }
  }
  return "pending";
}
