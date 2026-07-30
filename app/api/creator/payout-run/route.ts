import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import {
  PAYOUTS_TABLE,
  MIN_PAYOUT_AMOUNT_DEFAULT,
  calculateRevenueBalance,
  getNextPayoutWindow,
} from "@/app/lib/creatorPayouts";

// Monthly payout batch run — real eligibility computation over each
// creator's real, ledger-backed earnings (InPlayer-Creator-Payouts.
// lifetimeEarnedInr, credited by app/api/webhooks/razorpay on every
// confirmed membership charge), producing a real queued-for-transfer list.
// This deliberately stops there: it does NOT call Razorpay (or any other
// payment rail) and does NOT move money. There is no live bank-transfer
// integration in this project yet (see the disabled "Connect bank account
// via Razorpay" button in RevenueSection.tsx) — building one is a real,
// separate, KYC/compliance-heavy integration project, and actually
// executing a fund transfer isn't something this assistant can do
// regardless. What this route DOES give you: every verified creator's
// real, computed balance, refreshed and written back to
// InPlayer-Creator-Payouts so an admin (or, later, a real Razorpay payout
// job reading these same fields) knows exactly who's due and how much, the
// moment payouts go live.
//
// Call this once a day during the 1st–5th payout window (or anytime, to
// preview current standing) with:
//   Authorization: Bearer <secret>
// Accepts either CRON_SECRET (Vercel sets this header automatically on
// Vercel Cron requests when a CRON_SECRET env var exists on the project —
// see vercel.json) or PAYOUT_RUN_SECRET (a generic name for any other host
// / external scheduler that can send a custom header). Either env var
// works; set whichever matches how you end up triggering this. Vercel Cron
// only ever sends GET, so GET and POST both run the exact same logic here.
async function runPayoutBatch(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.PAYOUT_RUN_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const provided = authHeader.replace(/^Bearer\s+/i, "");

  if (!secret) {
    return NextResponse.json(
      {
        error:
          "Set CRON_SECRET or PAYOUT_RUN_SECRET in your environment variables before this route can run.",
      },
      { status: 503 }
    );
  }
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const window = getNextPayoutWindow();

  interface PayoutRecord {
    userId: string;
    kycStatus?: string;
    lifetimeEarnedInr?: number;
    lifetimePaidOutInr?: number;
    minPayoutAmount?: number;
  }

  let verifiedCreators: PayoutRecord[];
  try {
    const payoutsResult = await docClient.send(
      new ScanCommand({
        TableName: PAYOUTS_TABLE,
        FilterExpression: "kycStatus = :verified",
        ExpressionAttributeValues: { ":verified": "verified" },
      })
    );
    // userId is this table's partition key, so it's guaranteed present on
    // every real item — DynamoDB's Document Client just types Items loosely.
    verifiedCreators = (payoutsResult.Items || []) as PayoutRecord[];
  } catch (err) {
    console.error("payout-run: couldn't scan payouts table:", err);
    return NextResponse.json(
      { error: "InPlayer-Creator-Payouts isn't available yet." },
      { status: 503 }
    );
  }

  interface PayoutRunResult {
    userId: string;
    lifetimeEarnedInr: number;
    balance: number;
    eligible: boolean;
    failed: boolean;
  }

  const results: PayoutRunResult[] = await Promise.all(
    verifiedCreators.map(async (creator): Promise<PayoutRunResult> => {
      const userId = creator.userId as string;
      try {
        // lifetimeEarnedInr is credited by the Razorpay webhook handler
        // (app/api/webhooks/razorpay) on every confirmed membership
        // charge — this is real money already collected, not an estimate.
        const lifetimeEarnedInr = creator.lifetimeEarnedInr || 0;
        const alreadyPaidOutInr = creator.lifetimePaidOutInr || 0;
        const balance = calculateRevenueBalance(lifetimeEarnedInr, alreadyPaidOutInr);
        const minPayoutAmount = creator.minPayoutAmount || MIN_PAYOUT_AMOUNT_DEFAULT;
        const eligible = balance >= minPayoutAmount;

        await docClient.send(
          new UpdateCommand({
            TableName: PAYOUTS_TABLE,
            Key: { userId },
            UpdateExpression:
              "SET pendingPayoutInr = :balance, payoutEligible = :eligible, " +
              "payoutWindowLabel = :windowLabel, lastPayoutRunAt = :ranAt",
            ExpressionAttributeValues: {
              ":balance": balance,
              ":eligible": eligible,
              ":windowLabel": window.label,
              ":ranAt": new Date().toISOString(),
            },
          })
        );

        return { userId, lifetimeEarnedInr, balance, eligible, failed: false };
      } catch (err) {
        console.error(`payout-run: failed for creator ${userId}:`, err);
        return { userId, lifetimeEarnedInr: 0, balance: 0, eligible: false, failed: true };
      }
    })
  );

  const eligible = results.filter((r) => r.eligible);

  return NextResponse.json({
    windowLabel: window.label,
    isOpenNow: window.isOpenNow,
    creatorsChecked: results.length,
    creatorsEligible: eligible.length,
    totalPendingInr: eligible.reduce((sum, r) => sum + r.balance, 0),
    results,
  });
}

export async function GET(request: NextRequest) {
  return runPayoutBatch(request);
}

export async function POST(request: NextRequest) {
  return runPayoutBatch(request);
}
