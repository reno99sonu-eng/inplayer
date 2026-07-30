import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { PAYOUTS_TABLE, MIN_PAYOUT_AMOUNT_DEFAULT } from "@/app/lib/creatorPayouts";

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const defaultStatus = {
    kycStatus: "not_started" as const,
    payoutFrequency: null as string | null,
    legalName: null as string | null,
    submittedAt: null as string | null,
    minPayoutAmount: MIN_PAYOUT_AMOUNT_DEFAULT,
    lifetimeEarnedInr: 0,
    lifetimePaidOutInr: 0,
  };

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: PAYOUTS_TABLE,
        Key: { userId: user.userId },
      })
    );

    if (!result.Item) {
      return NextResponse.json(defaultStatus);
    }

    return NextResponse.json({
      kycStatus: result.Item.kycStatus || "not_started",
      payoutFrequency: result.Item.payoutFrequency || null,
      legalName: result.Item.legalName || null,
      submittedAt: result.Item.submittedAt || null,
      minPayoutAmount: result.Item.minPayoutAmount || MIN_PAYOUT_AMOUNT_DEFAULT,
      // Real money already collected via paid memberships, credited by
      // app/api/webhooks/razorpay on every confirmed charge — not an
      // estimate derived from views.
      lifetimeEarnedInr: result.Item.lifetimeEarnedInr || 0,
      lifetimePaidOutInr: result.Item.lifetimePaidOutInr || 0,
      rejectionReason: result.Item.rejectionReason || null,
    });
  } catch (err) {
    // The InPlayer-Creator-Payouts table needs to exist in DynamoDB (userId
    // as the partition key) before this feature goes live. Until then,
    // fail open to the same "not started" shape so the rest of the Your
    // Channel page keeps working normally.
    console.error("Creator payouts table unavailable:", err);
    return NextResponse.json(defaultStatus);
  }
}
