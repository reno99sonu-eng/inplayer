// Shared constants for the creator revenue/payout feature. Kept out of the
// route.ts files themselves — Next.js route modules should only export HTTP
// method handlers (GET/POST/etc.) and a small set of route config options,
// not arbitrary business-logic constants.

export const PAYOUTS_TABLE = "InPlayer-Creator-Payouts";

// Every individual real charge (a paid membership's monthly Razorpay
// renewal) is recorded once here, keyed by Razorpay's own payment id —
// that's what makes a duplicate webhook delivery (Razorpay retries on
// anything but a 2xx response) a safe no-op instead of double-crediting a
// creator. See app/api/webhooks/razorpay.
export const REVENUE_LEDGER_TABLE = "InPlayer-Revenue-Ledger";

// Real memberships: one row per (subscriberId, creatorId) pair.
export const MEMBERSHIPS_TABLE = "InPlayer-Memberships";

export const MEMBERSHIP_PRICE_INR = 119;

// The one true split, applied to every real charge recorded in the
// revenue ledger — 80% to the creator whose membership was paid for, 20%
// to InPlayer.
export const CREATOR_SHARE = 0.8;
export const PLATFORM_SHARE = 0.2;

// Eligibility is intentionally simple and stated in one place so it's easy
// to tune later: 100 In-Family members (subscribers) AND 10,000 total views
// (videos + Shorts combined) unlocks the KYC / revenue flow.
export const ELIGIBILITY_THRESHOLD = {
  subscribers: 100,
  views: 10000,
};

export type KycStatus = "not_started" | "pending_review" | "verified";
export type PayoutFrequency = "daily" | "weekly" | "monthly" | "annually";

export const PAYOUT_FREQUENCIES: PayoutFrequency[] = [
  "daily",
  "weekly",
  "monthly",
  "annually",
];

// The creator's own minimum-balance threshold before a payout goes out —
// e.g. "only pay me out once I've got at least ₹500 owed", paired with
// their chosen frequency above (YouTube/AdSense call this a "payment
// threshold"). Stored as a preference now so the schedule is ready the
// moment real payouts (via Razorpay) go live — it does not itself move any
// money today.
export const MIN_PAYOUT_AMOUNT_DEFAULT = 500;
export const MIN_PAYOUT_AMOUNT_BOUNDS = { min: 100, max: 100000 };

// ---------------------------------------------------------------------
// Revenue calculation.
//
// InPlayer's first real revenue source is paid per-creator memberships
// (see app/api/memberships, app/api/webhooks/razorpay) — a viewer pays
// MEMBERSHIP_PRICE_INR/month via Razorpay, and CREATOR_SHARE (80%) of
// each confirmed charge is credited to that creator. Every charge is
// recorded once in InPlayer-Revenue-Ledger and folded into
// InPlayer-Creator-Payouts.lifetimeEarnedInr by the webhook handler — so
// "how many rupees has this creator actually earned" now has a real
// external source of truth (Razorpay), not a formula. This function is
// now just "earned minus already paid out", not a views-based estimate.
export function calculateRevenueBalance(
  lifetimeEarnedInr: number,
  alreadyPaidOutInr: number = 0
): number {
  return Math.max(
    0,
    Math.round((Math.max(0, lifetimeEarnedInr) - alreadyPaidOutInr) * 100) / 100
  );
}

// ---------------------------------------------------------------------
// Monthly payout window — real payouts run once a month, between the 1st
// and 5th (inclusive). Pure date math, no I/O, so both the UI (creator-
// facing "next payout" display) and the server-side payout-run route
// share one definition instead of two copies drifting apart.
export interface PayoutWindow {
  windowStart: Date; // 1st of the month, 00:00
  windowEnd: Date; // 5th of the month, 23:59:59.999
  isOpenNow: boolean;
  label: string; // e.g. "Aug 1–5, 2026" or "Currently processing (Jul 1–5)"
}

export function getNextPayoutWindow(referenceDate: Date = new Date()): PayoutWindow {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const dayOfMonth = referenceDate.getDate();

  const thisWindowStart = new Date(year, month, 1, 0, 0, 0, 0);
  const thisWindowEnd = new Date(year, month, 5, 23, 59, 59, 999);
  const isOpenNow = dayOfMonth >= 1 && dayOfMonth <= 5;

  const windowStart = isOpenNow ? thisWindowStart : new Date(year, month + 1, 1, 0, 0, 0, 0);
  const windowEnd = isOpenNow ? thisWindowEnd : new Date(year, month + 1, 5, 23, 59, 59, 999);

  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  const label = isOpenNow
    ? `Processing now (${fmt(windowStart)}–${windowEnd.getDate()})`
    : `${fmt(windowStart)}–${windowEnd.getDate()}, ${windowEnd.getFullYear()}`;

  return { windowStart, windowEnd, isOpenNow, label };
}
