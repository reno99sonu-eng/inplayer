import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import {
  PAYOUTS_TABLE,
  KYC_DOCUMENTS_TABLE,
  KYC_DOC_TYPES,
  KycDocType,
  KycStatus,
} from "@/app/lib/creatorPayouts";
import { resolveUsernames } from "@/app/lib/resolveUsernames";

// Real KYC review queue — every field an admin sees here (the text fields
// AND the four document photos) is exactly what the creator actually
// submitted via KycForm.tsx, nothing simulated or pre-approved. This is
// the only place in the app that ever reads InPlayer-KYC-Documents.
//
// Per policy: once a decision (approve or reject) is recorded, (a) the
// actual photos are purged from InPlayer-KYC-Documents immediately — see
// purgeDocuments() below — and (b) the street address fields are removed
// from the InPlayer-Creator-Payouts row itself (see the REMOVE clause in
// the POST handler). What survives review is only: legal name, PAN number,
// id proof type, the Aadhaar/passport number, and the bank account
// number/IFSC — a minimal text audit trail, never the underlying
// photos/address "just in case."
async function purgeDocuments(userId: string) {
  await Promise.all(
    KYC_DOC_TYPES.map((docType: KycDocType) =>
      docClient.send(
        new DeleteCommand({
          TableName: KYC_DOCUMENTS_TABLE,
          Key: { userId, docType },
        })
      )
    )
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tabParam = request.nextUrl.searchParams.get("tab");
  const status: KycStatus =
    tabParam === "verified" || tabParam === "rejected" ? tabParam : "pending_review";

  const items: Record<string, unknown>[] = [];
  try {
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: PAYOUTS_TABLE,
          FilterExpression: "kycStatus = :status",
          ExpressionAttributeValues: { ":status": status },
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      items.push(...((result.Items || []) as Record<string, unknown>[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
  } catch (err) {
    console.error("admin/creators: payouts scan failed (table may not exist yet):", err);
    return NextResponse.json({ items: [], tableMissing: true });
  }

  items.sort(
    (a, b) =>
      new Date((b.submittedAt as string) || 0).getTime() -
      new Date((a.submittedAt as string) || 0).getTime()
  );

  const usernames = await resolveUsernames(items.map((i) => i.userId as string));

  // Documents only still exist for submissions actually awaiting review —
  // purgeDocuments() above deletes them the moment a decision is recorded,
  // so skip the (now pointless) per-item query for the verified/rejected
  // tabs entirely.
  const withDocs = await Promise.all(
    items.map(async (item) => {
      const userId = item.userId as string;
      let documents: Record<string, string> = {};
      if (status === "pending_review") {
        try {
          const docsResult = await docClient.send(
            new QueryCommand({
              TableName: KYC_DOCUMENTS_TABLE,
              KeyConditionExpression: "userId = :userId",
              ExpressionAttributeValues: { ":userId": userId },
            })
          );
          documents = Object.fromEntries(
            (docsResult.Items || []).map((d) => [d.docType as string, d.imageDataUrl as string])
          );
        } catch (err) {
          console.error(`admin/creators: documents query failed for ${userId}:`, err);
        }
      }

      return {
        userId,
        username: usernames.get(userId) || null,
        legalName: item.legalName || null,
        panNumber: item.panNumber || null,
        idProofType: item.idProofType || null,
        aadhaarNumber: item.aadhaarNumber || null,
        passportNumber: item.passportNumber || null,
        bankAccountNumber: item.bankAccountNumber || null,
        bankIfsc: item.bankIfsc || null,
        // Only present pre-review — removed by the REMOVE clause the
        // moment a decision is recorded (see POST below).
        addressLine1: item.addressLine1 || null,
        city: item.city || null,
        state: item.state || null,
        pincode: item.pincode || null,
        payoutFrequency: item.payoutFrequency || null,
        minPayoutAmount: item.minPayoutAmount || null,
        submittedAt: item.submittedAt || null,
        reviewedAt: item.reviewedAt || null,
        reviewedBy: item.reviewedBy || null,
        rejectionReason: item.rejectionReason || null,
        documents,
      };
    })
  );

  return NextResponse.json({ items: withDocs });
}

export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { userId, action, reason } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  if (action === "reject" && !reason?.trim()) {
    return NextResponse.json({ error: "A reason is required to reject." }, { status: 400 });
  }

  // "state" (and, to be safe, its neighbors here) collide with DynamoDB's
  // reserved-word list, so they need ExpressionAttributeNames aliases
  // rather than being written bare into the UpdateExpression string.
  const addressFieldNames = {
    "#addressLine1": "addressLine1",
    "#city": "city",
    "#state": "state",
    "#pincode": "pincode",
  };

  try {
    if (action === "approve") {
      await docClient.send(
        new UpdateCommand({
          TableName: PAYOUTS_TABLE,
          Key: { userId },
          UpdateExpression:
            "SET kycStatus = :status, reviewedAt = :now, reviewedBy = :by REMOVE rejectionReason, #addressLine1, #city, #state, #pincode",
          ExpressionAttributeNames: addressFieldNames,
          ExpressionAttributeValues: {
            ":status": "verified",
            ":now": new Date().toISOString(),
            ":by": admin.email,
          },
        })
      );
    } else {
      await docClient.send(
        new UpdateCommand({
          TableName: PAYOUTS_TABLE,
          Key: { userId },
          UpdateExpression:
            "SET kycStatus = :status, reviewedAt = :now, reviewedBy = :by, rejectionReason = :reason REMOVE #addressLine1, #city, #state, #pincode",
          ExpressionAttributeNames: addressFieldNames,
          ExpressionAttributeValues: {
            ":status": "rejected",
            ":now": new Date().toISOString(),
            ":by": admin.email,
            ":reason": reason.trim(),
          },
        })
      );
    }
  } catch (err) {
    console.error(`admin/creators: ${action} failed for ${userId}:`, err);
    return NextResponse.json({ error: "Couldn't save that right now." }, { status: 500 });
  }

  // The review decision above is the part that has to succeed for this
  // request to count as done. Purging the photos is a required cleanup
  // step, not the thing being decided — so a failure here is logged loudly
  // (an admin should follow up and clear the row manually in AWS Console)
  // rather than telling the admin their approve/reject click failed when it
  // actually went through.
  try {
    await purgeDocuments(userId);
  } catch (err) {
    console.error(
      `admin/creators: decision saved but document purge FAILED for ${userId} — clear InPlayer-KYC-Documents manually:`,
      err
    );
  }

  return NextResponse.json({ success: true });
}
