import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import {
  PAYOUTS_TABLE,
  PAYOUT_FREQUENCIES,
  MIN_PAYOUT_AMOUNT_DEFAULT,
  MIN_PAYOUT_AMOUNT_BOUNDS,
} from "@/app/lib/creatorPayouts";

function isValidMinPayoutAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_PAYOUT_AMOUNT_BOUNDS.min &&
    value <= MIN_PAYOUT_AMOUNT_BOUNDS.max
  );
}

// Deliberately does NOT accept a bank account number or IFSC code. Real
// bank-account linking belongs to Razorpay's own onboarding flow (Razorpay
// Route / Contacts & Fund Accounts) once this project has live API keys —
// collecting raw account numbers into our own table ahead of that would
// mean holding sensitive financial data we have no way to move or verify
// yet. This route only records identity/eligibility fields for the KYC
// review queue, plus the creator's preferred payout cadence.
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  // Updates the verified creator's own payout schedule — how often
  // (payoutFrequency) and the minimum balance to wait for first
  // (minPayoutAmount). Either field may be sent alone or together.
  if (action === "update_frequency" || action === "update_payout_prefs") {
    const { payoutFrequency, minPayoutAmount } = body;

    if (payoutFrequency !== undefined && !PAYOUT_FREQUENCIES.includes(payoutFrequency)) {
      return NextResponse.json({ error: "Invalid payout frequency." }, { status: 400 });
    }
    if (minPayoutAmount !== undefined && !isValidMinPayoutAmount(minPayoutAmount)) {
      return NextResponse.json(
        {
          error: `Minimum payout amount must be between ₹${MIN_PAYOUT_AMOUNT_BOUNDS.min} and ₹${MIN_PAYOUT_AMOUNT_BOUNDS.max}.`,
        },
        { status: 400 }
      );
    }

    try {
      const existing = await docClient.send(
        new GetCommand({ TableName: PAYOUTS_TABLE, Key: { userId: user.userId } })
      );
      if (!existing.Item) {
        return NextResponse.json(
          { error: "Submit KYC before setting up your payout schedule." },
          { status: 400 }
        );
      }

      const sets: string[] = [];
      const values: Record<string, unknown> = {};
      if (payoutFrequency !== undefined) {
        sets.push("payoutFrequency = :f");
        values[":f"] = payoutFrequency;
      }
      if (minPayoutAmount !== undefined) {
        sets.push("minPayoutAmount = :m");
        values[":m"] = minPayoutAmount;
      }

      if (sets.length > 0) {
        await docClient.send(
          new UpdateCommand({
            TableName: PAYOUTS_TABLE,
            Key: { userId: user.userId },
            UpdateExpression: `SET ${sets.join(", ")}`,
            ExpressionAttributeValues: values,
          })
        );
      }
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("Failed to update payout schedule:", err);
      return NextResponse.json(
        { error: "Couldn't save that right now. Please try again." },
        { status: 500 }
      );
    }
  }

  // Default action: submit KYC.
  const {
    legalName,
    panNumber,
    addressLine1,
    city,
    state,
    pincode,
    payoutFrequency,
    minPayoutAmount,
  } = body;

  if (!legalName?.trim() || !panNumber?.trim() || !addressLine1?.trim() ||
      !city?.trim() || !state?.trim() || !pincode?.trim()) {
    return NextResponse.json(
      { error: "Please fill in every field." },
      { status: 400 }
    );
  }

  const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  if (!panPattern.test(panNumber.trim().toUpperCase())) {
    return NextResponse.json(
      { error: "That doesn't look like a valid PAN (format: ABCDE1234F)." },
      { status: 400 }
    );
  }

  if (payoutFrequency && !PAYOUT_FREQUENCIES.includes(payoutFrequency)) {
    return NextResponse.json({ error: "Invalid payout frequency." }, { status: 400 });
  }
  if (minPayoutAmount !== undefined && !isValidMinPayoutAmount(minPayoutAmount)) {
    return NextResponse.json(
      {
        error: `Minimum payout amount must be between ₹${MIN_PAYOUT_AMOUNT_BOUNDS.min} and ₹${MIN_PAYOUT_AMOUNT_BOUNDS.max}.`,
      },
      { status: 400 }
    );
  }

  try {
    await docClient.send(
      new PutCommand({
        TableName: PAYOUTS_TABLE,
        Item: {
          userId: user.userId,
          kycStatus: "pending_review",
          legalName: legalName.trim(),
          panNumber: panNumber.trim().toUpperCase(),
          addressLine1: addressLine1.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          payoutFrequency: payoutFrequency || "monthly",
          minPayoutAmount: isValidMinPayoutAmount(minPayoutAmount)
            ? minPayoutAmount
            : MIN_PAYOUT_AMOUNT_DEFAULT,
          submittedAt: new Date().toISOString(),
        },
      })
    );

    return NextResponse.json({ success: true, kycStatus: "pending_review" });
  } catch (err) {
    // Almost certainly means InPlayer-Creator-Payouts doesn't exist yet in
    // DynamoDB (userId as the partition key) — see app/lib/creatorPayouts.ts.
    console.error("Failed to submit KYC — payouts table unavailable:", err);
    return NextResponse.json(
      { error: "KYC submission isn't available yet. Please try again later." },
      { status: 503 }
    );
  }
}
