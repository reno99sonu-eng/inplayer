import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import {
  PAYOUTS_TABLE,
  PAYOUT_FREQUENCIES,
  MIN_PAYOUT_AMOUNT_DEFAULT,
  MIN_PAYOUT_AMOUNT_BOUNDS,
  KYC_DOCUMENTS_TABLE,
  KYC_DOC_TYPES,
  KycDocType,
} from "@/app/lib/creatorPayouts";
import { KYC_DOCUMENT_DATA_URL_MAX_LENGTH } from "@/app/lib/imageCompress";

function isValidMinPayoutAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_PAYOUT_AMOUNT_BOUNDS.min &&
    value <= MIN_PAYOUT_AMOUNT_BOUNDS.max
  );
}

// A little headroom over the client's own compression target
// (KYC_DOCUMENT_DATA_URL_MAX_LENGTH) — this is the server's real
// enforcement, not just a client-side nicety a forged request could skip.
const MAX_DOCUMENT_LENGTH = KYC_DOCUMENT_DATA_URL_MAX_LENGTH * 1.2;

function isValidDocumentDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("data:image/") &&
    value.length > 100 &&
    value.length <= MAX_DOCUMENT_LENGTH
  );
}

// Collects a bank account number + IFSC as part of the KYC record itself
// (per the actual spec: a text number survives review, everything else —
// photos and street address — is purged). This is NOT the same thing as
// linking a payout destination — actual money movement still goes through
// Razorpay's own onboarding (Razorpay Route / Contacts & Fund Accounts)
// separately once this project has live API keys. What's stored here is
// only ever read by an admin for manual KYC review/audit, never used
// directly to move funds.
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
    idProofType,
    aadhaarNumber,
    passportNumber,
    bankAccountNumber,
    bankIfsc,
    payoutFrequency,
    minPayoutAmount,
    documents,
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

  if (idProofType !== "aadhaar" && idProofType !== "passport") {
    return NextResponse.json({ error: "Invalid ID proof type." }, { status: 400 });
  }

  // The number that actually survives review (see purgeDocuments/REMOVE
  // logic in app/api/admin/creators) — validated server-side since a
  // forged request could skip the client's own check.
  if (idProofType === "aadhaar") {
    if (!/^\d{12}$/.test(String(aadhaarNumber || "").trim())) {
      return NextResponse.json(
        { error: "Please enter a valid 12-digit Aadhaar number." },
        { status: 400 }
      );
    }
  } else {
    if (!/^[A-Za-z0-9]{6,9}$/.test(String(passportNumber || "").trim())) {
      return NextResponse.json(
        { error: "Please enter a valid passport number." },
        { status: 400 }
      );
    }
  }

  if (!/^\d{9,18}$/.test(String(bankAccountNumber || "").trim())) {
    return NextResponse.json(
      { error: "Please enter a valid bank account number." },
      { status: 400 }
    );
  }
  if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(String(bankIfsc || "").trim())) {
    return NextResponse.json({ error: "Please enter a valid IFSC code." }, { status: 400 });
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

  // This is a real, manually-reviewed KYC submission — an admin has to be
  // able to actually see all four documents to approve someone for real
  // money, so every one of them is required server-side, not just
  // client-side. See KycForm.tsx for why these four specifically (PAN,
  // Aadhaar/Passport, bank proof, selfie) — matches what was actually
  // asked for.
  if (!documents || typeof documents !== "object") {
    return NextResponse.json({ error: "Please upload all four documents." }, { status: 400 });
  }
  for (const docType of KYC_DOC_TYPES) {
    if (!isValidDocumentDataUrl((documents as Record<string, unknown>)[docType])) {
      return NextResponse.json(
        { error: "Please upload all four documents as clear photos." },
        { status: 400 }
      );
    }
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
          idProofType,
          aadhaarNumber: idProofType === "aadhaar" ? String(aadhaarNumber).trim() : null,
          passportNumber:
            idProofType === "passport" ? String(passportNumber).trim().toUpperCase() : null,
          bankAccountNumber: String(bankAccountNumber).trim(),
          bankIfsc: String(bankIfsc).trim().toUpperCase(),
          payoutFrequency: payoutFrequency || "monthly",
          minPayoutAmount: isValidMinPayoutAmount(minPayoutAmount)
            ? minPayoutAmount
            : MIN_PAYOUT_AMOUNT_DEFAULT,
          submittedAt: new Date().toISOString(),
          // A fresh PutCommand replaces the whole item, so a stale
          // rejectionReason/reviewedAt/reviewedBy from a previous rejected
          // attempt is gone the moment a resubmission lands here — nothing
          // extra to clear.
        },
      })
    );

    // Each document is its own row (InPlayer-KYC-Documents, keyed by
    // userId+docType) so none of them compete for space inside one
    // DynamoDB item's 400KB limit. A resubmission after a rejection just
    // overwrites these same four rows with the new photos.
    await Promise.all(
      KYC_DOC_TYPES.map((docType: KycDocType) =>
        docClient.send(
          new PutCommand({
            TableName: KYC_DOCUMENTS_TABLE,
            Item: {
              userId: user.userId,
              docType,
              imageDataUrl: (documents as Record<string, string>)[docType],
              uploadedAt: new Date().toISOString(),
            },
          })
        )
      )
    );

    return NextResponse.json({ success: true, kycStatus: "pending_review" });
  } catch (err) {
    // Almost certainly means InPlayer-Creator-Payouts or
    // InPlayer-KYC-Documents doesn't exist yet in DynamoDB — see
    // app/lib/creatorPayouts.ts for the required key schemas.
    console.error("Failed to submit KYC — a required table is unavailable:", err);
    return NextResponse.json(
      { error: "KYC submission isn't available yet. Please try again later." },
      { status: 503 }
    );
  }
}
