// Shared constants for the creator revenue/payout feature. Kept out of the
// route.ts files themselves — Next.js route modules should only export HTTP
// method handlers (GET/POST/etc.) and a small set of route config options,
// not arbitrary business-logic constants.

export const PAYOUTS_TABLE = "InPlayer-Creator-Payouts";

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
// IMPORTANT — read before changing: InPlayer has no ad network or
// subscription revenue-share plugged in yet (RevenueSection.tsx says as
// much: "updates once ad/revenue-share is connected on InPlayer's side").
// There is therefore no real, external source of truth for "how many
// rupees has this creator actually earned" — no rate has ever been
// specified anywhere in this codebase or by the person running it. This
// constant is a clearly-labeled, easily-tunable placeholder so the balance
// shown to creators is a real, live, computed number driven by their real
// view counts (not a hardcoded ₹0.00) rather than fabricated per-creator —
// but the RATE ITSELF is a business decision, not an engineering one.
// Confirm/replace this with the actual payout rate before this is treated
// as a real financial promise to creators.
export const REVENUE_PER_1000_VIEWS_INR = 30;

export function calculateRevenueBalance(
  totalViews: number,
  alreadyPaidOutInr: number = 0
): number {
  const earned = (Math.max(0, totalViews) / 1000) * REVENUE_PER_1000_VIEWS_INR;
  return Math.max(0, Math.round((earned - alreadyPaidOutInr) * 100) / 100);
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
