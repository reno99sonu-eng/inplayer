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

// Hammart vendor's own ₹249/month platform subscription fee (unlocks
// publishing more listings past the first 10 free ones) — structurally
// identical to the creator-membership subscription above, but with a
// `vendorId` note instead of `subscriberId`/`creatorId` so the webhook
// handler (app/api/webhooks/razorpay/route.ts) can tell the two apart
// without a second lookup table. Reno needs to create a real ₹249/month
// Plan in the Razorpay Dashboard and set RAZORPAY_HAMMART_VENDOR_PLAN_ID —
// same manual-setup pattern as every DynamoDB table in this app.
export async function createVendorSubscription(params: {
  planId: string;
  vendorId: string;
}): Promise<RazorpaySubscription> {
  const res = await fetch(`${RAZORPAY_API_BASE}/subscriptions`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      plan_id: params.planId,
      total_count: INDEFINITE_MONTHLY_CYCLES,
      customer_notify: 1,
      notes: { vendorId: params.vendorId },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error((data?.error?.description as string) || "Razorpay subscription creation failed.");
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

// --- Route (marketplace split payments) -------------------------------
//
// Used by Hammart to pay vendors automatically — an OPTIONAL upgrade on
// top of the original buyer-pays-the-vendor's-own-UPI-ID flow, never a
// requirement (see app/api/hammart/checkout/route.ts's header comment: a
// vendor without an active linked account here just keeps selling via
// direct UPI). A buyer's payment lands in InPlayer's own Razorpay balance
// first, and Route's `transfers` array (see createOrderWithTransfer
// below) is what peels off the vendor's share and sends it to their own
// "Linked Account" — automatically, at the moment the payment is
// captured, no manual step.
//
// IMPORTANT — Route has to be enabled for Reno's Razorpay account first
// (Dashboard -> Account & Settings -> Route, or Razorpay support if it's
// not visible there), and Razorpay does its own underwriting/review of
// every linked account before it can actually receive a transfer. Nothing
// in this file can skip either of those — a linked account created here
// starts in Razorpay's "created"/pending state, not immediately payable.
// That's exactly why every caller of createLinkedAccount stores the
// result as VendorProfile.razorpayAccountStatus = "pending", and
// app/api/hammart/checkout/route.ts only ever uses the Razorpay path for
// that vendor once that flips to "active" — either via the
// account.activated webhook event, or an admin manually re-syncing with
// fetchLinkedAccount. Until then (or if it never happens at all), the
// vendor simply stays on the UPI fallback — nothing about that is an
// error state.

export interface RazorpayLinkedAccountResponse {
  id: string;
  status: string; // Razorpay's own string, e.g. "created" | "activated" | "under_review" | "suspended"
  [key: string]: unknown;
}

export async function createLinkedAccount(params: {
  // Sent to Razorpay as reference_id — pass InPlayer's own userId here
  // (the VENDORS_TABLE PK), not the public vendorId slug, so an
  // account.* webhook event can be mapped straight back to a row. See the
  // call site in app/api/admin/hammart-vendors/route.ts.
  vendorId: string;
  email: string;
  phone?: string | null;
  legalName: string;
  businessType: "individual" | "business";
  panNumber: string;
  bankAccountNumber: string;
  bankIfsc: string;
}): Promise<RazorpayLinkedAccountResponse> {
  const res = await fetch("https://api.razorpay.com/v2/accounts", {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      email: params.email,
      phone: params.phone || "9999999999",
      type: "route",
      reference_id: params.vendorId,
      legal_business_name: params.legalName,
      business_type: params.businessType === "business" ? "partnership" : "individual",
      contact_name: params.legalName,
      profile: {
        category: "ecommerce",
        subcategory: "ecommerce",
        addresses: {
          registered: {
            street1: "Not provided",
            city: "Unknown",
            state: "Unknown",
            postal_code: "000000",
            country: "IN",
          },
        },
      },
      legal_info: {
        pan: params.panNumber,
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data?.error?.description as string) || "Razorpay linked account creation failed.");
  }

  // The account above exists but can't settle anywhere yet — this second
  // call is what actually attaches the vendor's bank account as the Route
  // settlement destination and accepts Razorpay's Route terms on their
  // behalf (they already agreed to Hammart's own Vendor Terms, which
  // cover this, during KYC submission — see VendorKycForm.tsx). Kept as a
  // separate try/catch: if THIS step fails, the account still exists at
  // Razorpay (a retry should reuse the same account id, not create a
  // second one), so the caller stores razorpayAccountStatus = "failed"
  // with this error rather than silently losing track of the id.
  try {
    const pRes = await fetch(`https://api.razorpay.com/v2/accounts/${encodeURIComponent(data.id)}/products`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        product_name: "route",
        tnc_accepted: true,
        settlements: {
          account_number: params.bankAccountNumber,
          ifsc_code: params.bankIfsc,
          beneficiary_name: params.legalName,
        },
      }),
    });
    
    // Check if the products call actually succeeded, so the caller doesn't assume success.
    const pData = await pRes.json().catch(() => null);
    if (!pRes.ok) {
       throw new Error((pData?.error?.description as string) || "Razorpay products (settlement) config failed.");
    }
  } catch (err) {
    console.error(`razorpay: settlement config failed for linked account ${data.id}:`, err);
    // Throw so attemptRazorpayOnboarding sees this as a failure and allows retrying!
    throw err;
  }

  return data as RazorpayLinkedAccountResponse;
}

// Re-fetches a linked account's current status directly from Razorpay —
// used by the admin "sync" action (app/api/admin/hammart-vendors/route.ts)
// as a manual fallback for whenever the account.activated webhook event
// either hasn't fired yet or was missed, so Reno never has to just guess
// whether a vendor is actually ready to receive real transfers.
export async function fetchLinkedAccount(accountId: string): Promise<RazorpayLinkedAccountResponse> {
  const res = await fetch(`https://api.razorpay.com/v2/accounts/${encodeURIComponent(accountId)}`, {
    headers: { Authorization: authHeader() },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data?.error?.description as string) || "Couldn't fetch linked account status.");
  }
  return data as RazorpayLinkedAccountResponse;
}

export interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
  [key: string]: unknown;
}

// Creates a real Razorpay Order carrying a Route `transfers` entry — this
// is what a buyer's Checkout popup (app/shop/cart/page.tsx,
// app/shop/product/[productId]/page.tsx) actually pays against. The
// transfer amount already has InPlayer's flat commission subtracted (see
// app/lib/hammartOrderMath.ts's vendorPayoutInr) — Razorpay automatically
// sends exactly that much to the vendor's linked account the moment the
// payment captures, and leaves the commission behind in InPlayer's own
// balance without any extra step here.
export async function createOrderWithTransfer(params: {
  amountInr: number;
  vendorAccountId: string;
  vendorPayoutInr: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrderResponse> {
  const res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(params.amountInr * 100),
      currency: "INR",
      receipt: params.receipt,
      notes: params.notes,
      transfers: [
        {
          account: params.vendorAccountId,
          amount: Math.round(params.vendorPayoutInr * 100),
          currency: "INR",
          notes: params.notes,
          on_hold: 0,
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data?.error?.description as string) || "Razorpay order creation failed.");
  }
  return data as RazorpayOrderResponse;
}

// --- Plain one-time Order (no transfers) -------------------------------
//
// Used by the ad-sponsorship feature (app/api/sponsorships/checkout) — a
// sponsor pays InPlayer directly for a 7-day ad placement. Deliberately
// NOT createOrderWithTransfer: there's no third party being paid here at
// all, the money simply lands in InPlayer's own Razorpay balance exactly
// like a Hammart vendor's own commission or a membership charge, so this
// never needs Route and is never affected by the RBI turnover threshold
// that gates Route (see createLinkedAccount's comment above, and
// claude/website-fixes-log.md).
export async function createPlainOrder(params: {
  amountInr: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrderResponse> {
  const res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(params.amountInr * 100),
      currency: "INR",
      receipt: params.receipt,
      notes: params.notes,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data?.error?.description as string) || "Razorpay order creation failed.");
  }
  return data as RazorpayOrderResponse;
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

// Same purpose as verifyCheckoutSignature above, but for a plain Order
// payment (Hammart checkout) instead of a subscription — Razorpay signs
// `order_id|payment_id` instead of `payment_id|subscription_id` for this
// flow. Same caveat applies: this only unlocks an optimistic "processing"
// UI state (app/shop/cart/page.tsx starts polling from here) — the order
// only actually flips to "paid" once the webhook's payment.captured event
// lands (app/api/webhooks/razorpay/route.ts).
export function verifyOrderCheckoutSignature(params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  const payload = `${params.razorpay_order_id}|${params.razorpay_payment_id}`;
  const expected = createHmac("sha256", keySecret).update(payload).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(params.razorpay_signature, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
