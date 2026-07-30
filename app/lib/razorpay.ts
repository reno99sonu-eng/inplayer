import { createHmac, timingSafeEqual } from "crypto";

// Thin REST wrapper — no razorpay npm SDK dependency, just fetch() with
// Basic Auth (Key ID:Key Secret), which is all Razorpay's API actually
// requires. Keeps this project's dependency footprint the same as it's
// always been (AWS/Mux both use their own SDKs; Razorpay doesn't need one).
const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function authHeader(): string {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

export interface RazorpaySubscription {
  id: string;
  status: string;
  short_url?: string;
  [key: string]: unknown;
}

// total_count is required by Razorpay for a Subscription — there's no
// literal "bill forever" option. 1200 monthly cycles (100 years) is the
// standard way integrations express "until the customer cancels" without
// actually expecting it to run that long.
const INDEFINITE_MONTHLY_CYCLES = 1200;

export async function createSubscription(params: {
  planId: string;
  subscriberId: string;
  creatorId: string;
}): Promise<RazorpaySubscription> {
  const res = await fetch(`${RAZORPAY_API_BASE}/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: params.planId,
      total_count: INDEFINITE_MONTHLY_CYCLES,
      customer_notify: 1,
      // Round-tripped back on every webhook event for this subscription —
      // this is how the webhook handler knows which (subscriber, creator)
      // membership a charge/cancellation belongs to, with no extra lookup
      // table needed to map a Razorpay subscription id back to our own
      // records.
      notes: {
        subscriberId: params.subscriberId,
        creatorId: params.creatorId,
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      (data?.error?.description as string) || "Razorpay subscription creation failed."
    );
  }
  return data as RazorpaySubscription;
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const res = await fetch(
    `${RAZORPAY_API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      // cancel_at_cycle_end: 0 — cancel immediately rather than waiting out
      // a period already paid for. InPlayer doesn't currently track "access
      // until period end" separately from "membership row exists", so an
      // immediate cancel is the version that matches what the rest of the
      // app assumes.
      body: JSON.stringify({ cancel_at_cycle_end: 0 }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      (data?.error?.description as string) || "Razorpay subscription cancellation failed."
    );
  }
}

// Verifies the X-Razorpay-Signature header on an incoming webhook — this
// is what proves a POST to /api/webhooks/razorpay actually came from
// Razorpay and not an attacker forging "a payment succeeded" to unlock a
// membership for free. HMAC-SHA256 of the raw request body, keyed with the
// webhook secret configured in the Razorpay Dashboard (Settings ->
// Webhooks) — must be the RAW body string, computed BEFORE any JSON.parse.
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  // Constant-time compare — a naive `===` here would leak timing
  // information an attacker could use to guess the correct signature
  // byte-by-byte.
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

// Verifies the signature Razorpay's Checkout.js hands back to the browser
// right after a subscription's first payment/mandate completes. This is
// a client-reported signal, not a substitute for the webhook — it's used
// only to show an immediate "you're in!" UI state, never to write the
// membership as active on its own (see app/api/memberships/subscribe).
export function verifyCheckoutSignature(params: {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  const payload = `${params.razorpay_payment_id}|${params.razorpay_subscription_id}`;
  const expected = createHmac("sha256", keySecret).update(payload).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(params.razorpay_signature, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
