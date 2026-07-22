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
