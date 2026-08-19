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
import { logAdminAction } from "@/app/lib/auditLog";
import { BatchGetCommand } from "@aws-sdk/lib-dynamodb";

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || "InPlayer-Users";

async function purgeDocuments(userId: string) {
  await Promise.all(
    KYC_DOC_TYPES.map((docType: KycDocType) =>
      docClient.send(
        new DeleteCommand({
          TableName: KYC_DOCUMENTS_TABLE,
          Key: { userId, docType },
        })
      ).catch(() => null)
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

  const payoutItems: Record<string, unknown>[] = [];
  // The page already renders an amber "table not created in AWS yet" banner
  // off this flag, but the route never actually sent it — so a missing
  // InPlayer-Creator-Payouts table rendered as a cheerful "Nothing waiting
  // on review", which is indistinguishable from a genuinely empty queue and
  // exactly the wrong thing to tell an admin.
  let tableMissing = false;
  try {
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await docClient
        .send(
          new ScanCommand({
            TableName: PAYOUTS_TABLE,
            FilterExpression: "kycStatus = :status",
            ExpressionAttributeValues: { ":status": status },
            ExclusiveStartKey: exclusiveStartKey,
          })
        )
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === "ResourceNotFoundException") {
            tableMissing = true;
          } else {
            console.error("admin/creators: payouts scan page failed:", err);
          }
          return null;
        });

      if (result?.Items) {
        payoutItems.push(...(result.Items as Record<string, unknown>[]));
      }
      exclusiveStartKey = result?.LastEvaluatedKey;
    } while (exclusiveStartKey);
  } catch (err) {
    console.error("admin/creators: payouts scan failed:", err);
  }

  // ── REMOVED: synthesized "creator" rows ────────────────────────────
  //
  // This used to Scan InPlayer-Users and InPlayer-Videos (Limit: 100 each)
  // and manufacture a KYC submission for every account and every video
  // uploader it found — hardcoding kycStatus: "verified", reviewedBy:
  // "System", payoutFrequency: "monthly", minPayoutAmount: 1000 and a
  // submittedAt taken from the account's creation date.
  //
  // None of those people had submitted anything. The page presents this
  // list under the words "Every submission here is a real person's real
  // documents", so the Verified tab was entirely fictional and the Pending
  // tab listed the whole user base as awaiting review.
  //
  // Worse, it wasn't only cosmetic: pressing Approve on one of these ghosts
  // ran an UpdateCommand against InPlayer-Creator-Payouts for a userId with
  // no payout row, and DynamoDB UpdateItem upserts — so it CREATED a payout
  // record with kycStatus: "verified". That record then satisfies the
  // kycStatus !== "not_started" filter in app/api/admin/revenue, putting a
  // fabricated creator permanently into the Revenue ledger. An admin
  // clearing what looked like a review backlog was silently writing junk
  // into payouts.
  //
  // The real source of truth is InPlayer-Creator-Payouts, scanned above: a
  // row exists there only once a creator has actually gone through the KYC
  // form. An empty queue now correctly means "nobody has applied yet".

  const allItems = [...payoutItems];

  allItems.sort(
    (a, b) =>
      new Date((b.submittedAt as string) || 0).getTime() -
      new Date((a.submittedAt as string) || 0).getTime()
  );

  const usernames = await resolveUsernames(allItems.map((i) => String(i.userId)));

  const monetizationStatuses = new Map<string, string>();
  const distinctIds = Array.from(new Set(allItems.map((i) => String(i.userId))));
  for (let index = 0; index < distinctIds.length; index += 100) {
    const keys = distinctIds.slice(index, index + 100).map((userId) => ({ userId }));
    try {
      let pendingKeys = keys;
      do {
        const result = await docClient.send(
          new BatchGetCommand({
            RequestItems: {
              [USERS_TABLE]: {
                Keys: pendingKeys,
                ProjectionExpression: "userId, monetizationStatus",
              },
            },
          })
        ).catch(() => null);

        const items = result?.Responses?.[USERS_TABLE] || [];
        for (const item of items) {
          monetizationStatuses.set(item.userId as string, (item.monetizationStatus as string) || "NOT_ELIGIBLE");
        }

        const unprocessed = result?.UnprocessedKeys?.[USERS_TABLE]?.Keys;
        if (unprocessed && unprocessed.length > 0) {
          pendingKeys = unprocessed as { userId: string }[];
        } else {
          break;
        }
      } while (true);
    } catch (err) {
      console.error("admin/creators: monetizationStatus batch get failed:", err);
    }
  }

  const withDocs = await Promise.all(
    allItems.map(async (item) => {
      const userId = String(item.userId);
      let documents: Record<string, string> = {};
      if (status === "pending_review") {
        try {
          const docsResult = await docClient.send(
            new QueryCommand({
              TableName: KYC_DOCUMENTS_TABLE,
              KeyConditionExpression: "userId = :userId",
              ExpressionAttributeValues: { ":userId": userId },
            })
          ).catch(() => null);
          if (docsResult?.Items) {
            documents = Object.fromEntries(
              docsResult.Items.map((d) => [d.docType as string, d.imageDataUrl as string])
            );
          }
        } catch (err) {
          console.error(`admin/creators: documents query failed for ${userId}:`, err);
        }
      }

      return {
        userId,
        username: (item.username as string | null) || usernames.get(userId) || null,
        legalName: (item.legalName as string | null) || null,
        panNumber: (item.panNumber as string | null) || null,
        idProofType: (item.idProofType as string | null) || null,
        aadhaarNumber: (item.aadhaarNumber as string | null) || null,
        passportNumber: (item.passportNumber as string | null) || null,
        bankAccountNumber: (item.bankAccountNumber as string | null) || null,
        bankIfsc: (item.bankIfsc as string | null) || null,
        addressLine1: (item.addressLine1 as string | null) || null,
        city: (item.city as string | null) || null,
        state: (item.state as string | null) || null,
        pincode: (item.pincode as string | null) || null,
        payoutFrequency: (item.payoutFrequency as string | null) || null,
        minPayoutAmount: (item.minPayoutAmount as number | null) || null,
        submittedAt: (item.submittedAt as string | null) || null,
        reviewedAt: (item.reviewedAt as string | null) || null,
        reviewedBy: (item.reviewedBy as string | null) || null,
        rejectionReason: (item.rejectionReason as string | null) || null,
        kycStatus: (item.kycStatus as string | null) || null,
        monetizationStatus: monetizationStatuses.get(userId) || "NOT_ELIGIBLE",
        documents,
      };
    })
  );

  return NextResponse.json({ items: withDocs, tableMissing });
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
  if (action !== "approve" && action !== "reject" && action !== "suspend" && action !== "unsuspend") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  if (action === "reject" && !reason?.trim()) {
    return NextResponse.json({ error: "A reason is required to reject." }, { status: 400 });
  }

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
    } else if (action === "reject") {
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
    } else if (action === "suspend") {
      await docClient.send(
        new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { userId },
          UpdateExpression: "SET monetizationStatus = :status",
          ExpressionAttributeValues: { ":status": "SUSPENDED" },
        })
      );
    } else if (action === "unsuspend") {
      await docClient.send(
        new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { userId },
          UpdateExpression: "SET monetizationStatus = :status",
          // Let them go back to MONETIZED immediately if they were suspended
          ExpressionAttributeValues: { ":status": "MONETIZED" },
        })
      );
    }
  } catch (err) {
    console.error(`admin/creators: ${action} failed for ${userId}:`, err);
    return NextResponse.json({ error: "Couldn't save that right now." }, { status: 500 });
  }

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: action === "approve" ? "kyc.approve" :
            action === "reject" ? "kyc.reject" :
            action === "suspend" ? "monetization.suspend" : "monetization.unsuspend",
    targetType: "user",
    targetId: userId,
    details: action === "reject" || action === "suspend" ? reason?.trim() : undefined,
  });

  if (action === "approve" || action === "reject") {
    try {
      await purgeDocuments(userId);
    } catch (err) {
      console.error(`admin/creators: document purge FAILED for ${userId}:`, err);
    }
  }

  return NextResponse.json({ success: true });
}
