"use client";

import QRCode from "qrcode";

// Shared client-side checkout orchestration for Hammart — used by both
// app/shop/cart/page.tsx (multi-item, possibly multi-vendor) and
// app/shop/product/[productId]/page.tsx ("Buy Now", always a single
// vendor group). Kept as one shared module rather than duplicated in both
// pages specifically because this is real-money checkout code: two
// slightly-different copies drifting apart over time is exactly the kind
// of thing that turns into a silent bug in only one of the two purchase
// paths. Same loadCheckoutScript pattern as app/components/MembershipButton.tsx.
//
// Handles BOTH payment methods a vendor group can come back as (see
// app/api/hammart/checkout/route.ts): "razorpay" (real gateway Checkout
// popup, webhook-verified) or "upi" (buyer pays the vendor's UPI ID
// directly via QR/link, vendor self-confirms — no gateway involved, so no
// popup and nothing to poll for).

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

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

export interface CheckoutGroupResult {
  vendorUserId: string;
  vendorId: string;
  success: boolean;
  error?: string;
  paymentMethod?: "razorpay" | "upi";
  // razorpay path
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  // upi path
  upiLink?: string;
  vendorUpiId?: string;
  amountInr?: number;
  orderIds?: string[];
}

export interface CheckoutFailedItem {
  productId: string;
  productTitle: string;
  error: string;
}

export interface CheckoutResponse {
  groups: CheckoutGroupResult[];
  failedItems: CheckoutFailedItem[];
}

// Calls the real checkout endpoint — see app/api/hammart/checkout/route.ts
// for what this actually does server-side (vendor grouping, and the
// per-vendor choice between a real Razorpay Order+transfer or a direct
// UPI fallback).
export async function postHammartCheckout(params: {
  authedFetch: (url: string, init?: RequestInit) => Promise<Response>;
  items: { productId: string; quantity: number }[];
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  deliveryAddress: string;
  city: string;
  state: string;
  pincode: string;
}): Promise<CheckoutResponse> {
  const res = await params.authedFetch("/api/hammart/checkout", {
    method: "POST",
    body: JSON.stringify({
      items: params.items,
      buyerName: params.buyerName,
      buyerEmail: params.buyerEmail,
      buyerPhone: params.buyerPhone,
      deliveryAddress: params.deliveryAddress,
      city: params.city,
      state: params.state,
      pincode: params.pincode,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Couldn't start checkout right now.");
  }
  return data as CheckoutResponse;
}

// Opens one real Razorpay Checkout popup for one vendor group's order.
// Resolves "submitted" the instant Checkout's own handler fires (payment
// was accepted by the gateway and Razorpay handed back a signed
// confirmation) — this is NOT the same as the order actually being marked
// "paid"; that only happens once the webhook lands (see
// app/api/webhooks/razorpay/route.ts), which is why every caller of this
// function polls for real status afterward rather than trusting this
// resolution as final. Resolves "dismissed" if the buyer closes the
// popup without paying — the order rows stay "payment_pending" (visible
// on /shop/orders, retryable), never silently lost.
export function openHammartCheckoutForGroup(
  group: CheckoutGroupResult,
  opts: { buyerName: string; buyerEmail: string; buyerPhone: string }
): Promise<"submitted" | "dismissed" | "unavailable"> {
  return new Promise((resolve) => {
    if (!group.razorpayKeyId || !group.razorpayOrderId || !window.Razorpay) {
      resolve("unavailable");
      return;
    }
    const razorpay = new window.Razorpay({
      key: group.razorpayKeyId,
      order_id: group.razorpayOrderId,
      name: "InPlayer Hammart",
      description: `Order from @${group.vendorId}`,
      prefill: { name: opts.buyerName, email: opts.buyerEmail, contact: opts.buyerPhone },
      theme: { color: "#FF9A00" },
      handler: () => resolve("submitted"),
      modal: {
        ondismiss: () => resolve("dismissed"),
      },
    });
    razorpay.open();
  });
}

// Renders a UPI deep-link as a scannable QR code data URL — used for the
// "upi" payment method path only (a vendor without an active Razorpay
// Route account). Returns undefined (never throws) if generation fails;
// callers already show the raw UPI ID and link as text too, so a failed
// QR render still leaves the buyer with a way to pay.
export async function generateUpiQrDataUrl(upiLink: string): Promise<string | undefined> {
  try {
    return await QRCode.toDataURL(upiLink, { width: 220, margin: 1 });
  } catch (err) {
    console.error("Failed to generate UPI QR code:", err);
    return undefined;
  }
}

// Polls GET /api/hammart/orders (the same endpoint /shop/orders already
// uses) until every orderId in the set has left its starting "pending"
// status, or the attempt budget runs out. Reused instead of a dedicated
// single-order status endpoint since the buyer's full order list is
// already fetched elsewhere — one source of truth for "what does this
// order's status say right now."
//
// `pendingStatus` is which status counts as "still waiting" — this
// differs by payment method because the two paths start from different
// initial statuses (see app/lib/hammartOrders.ts's OrderStatus/header
// comment): Razorpay-path orders start "payment_pending" (the default
// here, for backward compatibility with existing callers), direct-UPI
// orders start "placed". Getting this wrong would make the poll resolve
// on the very FIRST check, before the vendor has done anything — e.g.
// passing the Razorpay default against a UPI order would immediately
// return "placed" as if it were already a final answer, since "placed"
// !== "payment_pending" is true from attempt zero.
export async function pollHammartOrderStatuses(params: {
  authedFetch: (url: string, init?: RequestInit) => Promise<Response>;
  orderIds: string[];
  maxAttempts?: number;
  intervalMs?: number;
  pendingStatus?: string;
}): Promise<Record<string, string>> {
  const maxAttempts = params.maxAttempts ?? 12; // ~36s at 3s intervals — Route transfers settle near-instantly once captured
  const intervalMs = params.intervalMs ?? 3000;
  const pendingStatus = params.pendingStatus ?? "payment_pending";
  const remaining = new Set(params.orderIds);
  const statuses: Record<string, string> = {};

  for (let attempt = 0; attempt < maxAttempts && remaining.size > 0; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const res = await params.authedFetch("/api/hammart/orders");
      const data = await res.json().catch(() => ({}));
      const orders: { orderId: string; status: string }[] = data.orders || [];
      for (const order of orders) {
        if (remaining.has(order.orderId) && order.status !== pendingStatus) {
          statuses[order.orderId] = order.status;
          remaining.delete(order.orderId);
        }
      }
    } catch (err) {
      console.error("Failed to poll Hammart order statuses:", err);
    }
  }

  // Anything still pending after the budget just stays at its starting
  // pending status in the caller's eyes — not an error, just not resolved
  // yet (the buyer's own /shop/orders page will reflect the real status
  // the moment it actually changes, even if this poll gave up first).
  for (const orderId of remaining) statuses[orderId] = pendingStatus;
  return statuses;
}
