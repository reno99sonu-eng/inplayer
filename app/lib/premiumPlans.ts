// InPlayer Premium — what you can buy, and what it gets you.
//
// THIS FILE IS PURE (no DynamoDB, no next/headers) so the Plans card in
// Settings and the checkout route can share one definition of the plans and
// never drift on price or duration.
//
// WHERE THE PRICE MAY APPEAR: not on the public benefits list. Reno's rule
// for both Premium and ad sponsorships is the same — anyone can read what
// they'd be getting, the figure shows up when they actually start buying.
// GET /api/premium/plans therefore strips amountInr for signed-out callers
// (publicPlan below), and the Plans card only renders it once a plan has
// been picked and the checkout step is on screen.
//
// PRICES ARE A BUSINESS DECISION, NOT A TECHNICAL ONE. The two numbers
// below are the only place they live — change them here and the whole flow
// (Razorpay order, confirmation copy, the figure at checkout) follows.

export type PremiumPlanId = "monthly" | "yearly";

export interface PremiumPlan {
  planId: PremiumPlanId;
  label: string;
  /** What Razorpay actually charges. Never sent to a signed-out browser. */
  amountInr: number;
  /** How much Premium time one payment buys. */
  durationDays: number;
  /** Short line under the plan name, safe to show publicly. */
  cadence: string;
  /** Shown on the plan tile instead of a price, e.g. "Best value". */
  badge?: string;
}

// Only claims that are actually enforced today. effectiveMaxResolution()
// in app/lib/premium.ts caps the Mux rendition ladder by tier, and
// VideoPlayer.tsx passes that cap as maxResolution — that is the real,
// working difference between the tiers.
//
// Only list benefits enforced by the server. Offline downloads are now
// entitlement-checked by both prepare-download and download routes.
export const PREMIUM_BENEFITS: string[] = [
  "4K Ultra HD (2160p) streaming wherever the creator uploaded it",
  "2K (1440p) on supported videos — free accounts stop at 1080p",
  "The full quality ladder unlocked in Settings → Playback",
  "Offline downloads for supported videos and music",
  "Everything InPlayer Free already includes",
];

export const FREE_BENEFITS: string[] = [
  "Unlimited streaming on InPlayer",
  "Video quality up to 1080p (Full HD)",
  "Upload your own videos & Shorts",
  "Comment, like and subscribe",
];

export const PREMIUM_PLANS: Record<PremiumPlanId, PremiumPlan> = {
  monthly: {
    planId: "monthly",
    label: "Monthly",
    amountInr: 99,
    durationDays: 30,
    cadence: "Renews whenever you choose — one payment, 30 days",
  },
  yearly: {
    planId: "yearly",
    label: "Yearly",
    amountInr: 999,
    durationDays: 365,
    cadence: "One payment, a full year",
    badge: "Best value",
  },
};

export const PREMIUM_PLAN_LIST: PremiumPlan[] = [
  PREMIUM_PLANS.monthly,
  PREMIUM_PLANS.yearly,
];

export function isPremiumPlanId(raw: unknown): raw is PremiumPlanId {
  return raw === "monthly" || raw === "yearly";
}

/** The signed-out shape: everything except what it costs. */
export function publicPlan(plan: PremiumPlan): Omit<PremiumPlan, "amountInr"> & {
  amountInr?: number;
} {
  const { amountInr: _hidden, ...rest } = plan;
  void _hidden;
  return rest;
}

// NOTE ON RENEWAL: these are one-time Razorpay Orders, not Razorpay
// Subscriptions. A payment EXTENDS premiumUntil rather than starting a
// recurring mandate, so nobody is ever charged without tapping Pay again.
// That is the deliberate, safe starting point: no silent auto-debit, no
// mandate to cancel, and no way for a billing bug to charge a card twice.
// Moving to true auto-renew later means switching this to createSubscription
// (app/lib/razorpay.ts already has it, that's what creator memberships use)
// and handling subscription.charged in the webhook — the grant logic in
// premiumBilling.ts stays exactly as it is.
