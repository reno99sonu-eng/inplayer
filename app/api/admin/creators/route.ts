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

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || "InPlayer-Users";
const VIDEOS_TABLE = process.env.DYNAMODB_VIDEOS_TABLE || "InPlayer-Videos";

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
      ).catch(() => null);

      if (result?.Items) {
        payoutItems.push(...(result.Items as Record<string, unknown>[]));
      }
      exclusiveStartKey = result?.LastEvaluatedKey;
    } while (exclusiveStartKey);
  } catch (err) {
    console.error("admin/creators: payouts scan failed:", err);
  }

  // Also query users & video uploaders to discover existing creators on InPlayer
  const additionalCreators: Record<string, unknown>[] = [];
  const knownUserIds = new Set(payoutItems.map((i) => String(i.userId)));

  if (status === "verified" || status === "pending_review") {
    try {
      // Scan InPlayer-Users table for users marked as creators/uploaders
      const userScan = await docClient.send(
        new ScanCommand({
          TableName: USERS_TABLE,
          Limit: 100,
        })
      ).catch(() => null);

      if (userScan?.Items) {
        for (const u of userScan.Items as Record<string, unknown>[]) {
          const uid = String(u.userId || u.id || u.sub || "");
          if (uid && !knownUserIds.has(uid)) {
            knownUserIds.add(uid);
            additionalCreators.push({
              userId: uid,
              legalName: (u.displayName || u.username || u.name || "Creator") as string,
              username: (u.username || u.handle || null) as string | null,
              panNumber: null,
              idProofType: null,
              aadhaarNumber: null,
              passportNumber: null,
              bankAccountNumber: null,
              bankIfsc: null,
              addressLine1: null,
              city: null,
              state: null,
              pincode: null,
              payoutFrequency: "monthly",
              minPayoutAmount: 1000,
              submittedAt: (u.createdAt || new Date().toISOString()) as string,
              reviewedAt: null,
              reviewedBy: "System",
              rejectionReason: null,
              kycStatus: "verified",
            });
          }
        }
      }

      // Also scan video uploaders from InPlayer-Videos
      const videoScan = await docClient.send(
        new ScanCommand({
          TableName: VIDEOS_TABLE,
          Limit: 100,
        })
      ).catch(() => null);

      if (videoScan?.Items) {
        for (const v of videoScan.Items as Record<string, unknown>[]) {
          const uid = String(v.uploaderId || v.userId || "");
          const name = String(v.uploaderName || v.creator || "Creator");
          if (uid && !knownUserIds.has(uid)) {
            knownUserIds.add(uid);
            additionalCreators.push({
              userId: uid,
              legalName: name,
              username: (v.uploaderUsername || null) as string | null,
              panNumber: null,
              idProofType: null,
              aadhaarNumber: null,
              passportNumber: null,
              bankAccountNumber: null,
              bankIfsc: null,
              addressLine1: null,
              city: null,
              state: null,
              pincode: null,
              payoutFrequency: "monthly",
              minPayoutAmount: 1000,
              submittedAt: (v.uploadedAt || new Date().toISOString()) as string,
              reviewedAt: null,
              reviewedBy: "System",
              rejectionReason: null,
              kycStatus: "verified",
            });
          }
        }
      }
    } catch (err) {
      console.error("admin/creators: user/video fallback scan failed:", err);
    }
  }

  const allItems = [...payoutItems, ...additionalCreators];

  allItems.sort(
    (a, b) =>
      new Date((b.submittedAt as string) || 0).getTime() -
      new Date((a.submittedAt as string) || 0).getTime()
  );

  const usernames = await resolveUsernames(allItems.map((i) => String(i.userId)));

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

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: action === "approve" ? "kyc.approve" : "kyc.reject",
    targetType: "user",
    targetId: userId,
    details: action === "reject" ? reason.trim() : undefined,
  });

  try {
    await purgeDocuments(userId);
  } catch (err) {
    console.error(`admin/creators: document purge FAILED for ${userId}:`, err);
  }

  return NextResponse.json({ success: true });
}
