import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import {
  VENDORS_TABLE,
  VENDOR_KYC_DOCUMENTS_TABLE,
  vendorKycDocTypesFor,
  type VendorKycStatus,
  type VendorKycDocType,
} from "@/app/lib/hammartVendors";
import { resolveUsernames } from "@/app/lib/resolveUsernames";
import { logAdminAction } from "@/app/lib/auditLog";

// Same "purge photos + strip address the moment a decision is recorded"
// policy as app/api/admin/creators/route.ts — see that file's comments for
// the full "why."
async function purgeDocuments(userId: string, businessType: "individual" | "business") {
  await Promise.all(
    vendorKycDocTypesFor(businessType).map((docType: VendorKycDocType) =>
      docClient.send(new DeleteCommand({ TableName: VENDOR_KYC_DOCUMENTS_TABLE, Key: { userId, docType } }))
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
  const status: VendorKycStatus =
    tabParam === "verified" || tabParam === "rejected" ? tabParam : "pending_review";

  const items: Record<string, unknown>[] = [];
  try {
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: VENDORS_TABLE,
          FilterExpression: "kycStatus = :status",
          ExpressionAttributeValues: { ":status": status },
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      items.push(...((result.Items || []) as Record<string, unknown>[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
  } catch (err) {
    console.error("admin/hammart-vendors: scan failed (table may not exist yet):", err);
    return NextResponse.json({ items: [], tableMissing: true });
  }

  items.sort(
    (a, b) => new Date((b.submittedAt as string) || 0).getTime() - new Date((a.submittedAt as string) || 0).getTime()
  );

  const usernames = await resolveUsernames(items.map((i) => i.userId as string));

  const withDocs = await Promise.all(
    items.map(async (item) => {
      const userId = item.userId as string;
      const businessType = (item.businessType as "individual" | "business") || "individual";
      let documents: Record<string, string> = {};
      if (status === "pending_review") {
        try {
          const docsResult = await docClient.send(
            new QueryCommand({
              TableName: VENDOR_KYC_DOCUMENTS_TABLE,
              KeyConditionExpression: "userId = :userId",
              ExpressionAttributeValues: { ":userId": userId },
            })
          );
          documents = Object.fromEntries(
            (docsResult.Items || []).map((d) => [d.docType as string, d.imageDataUrl as string])
          );
        } catch (err) {
          console.error(`admin/hammart-vendors: documents query failed for ${userId}:`, err);
        }
      }

      return {
        userId,
        username: usernames.get(userId) || null,
        vendorId: item.vendorId || null,
        businessType,
        businessName: item.businessName || null,
        legalName: item.legalName || null,
        panNumber: item.panNumber || null,
        gstNumber: item.gstNumber || null,
        udyamNumber: item.udyamNumber || null,
        idProofType: item.idProofType || null,
        aadhaarNumber: item.aadhaarNumber || null,
        passportNumber: item.passportNumber || null,
        bankAccountNumber: item.bankAccountNumber || null,
        bankIfsc: item.bankIfsc || null,
        upiId: item.upiId || null,
        addressLine1: item.addressLine1 || null,
        city: item.city || null,
        state: item.state || null,
        pincode: item.pincode || null,
        submittedAt: item.submittedAt || null,
        reviewedAt: item.reviewedAt || null,
        reviewedBy: item.reviewedBy || null,
        rejectionReason: item.rejectionReason || null,
        suspended: Boolean(item.suspended),
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

  const body = await request.json().catch(() => ({}));
  const { userId, action, reason } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }
  if (!["approve", "reject", "suspend", "unsuspend"].includes(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  if (action === "reject" && !reason?.trim()) {
    return NextResponse.json({ error: "A reason is required to reject." }, { status: 400 });
  }

  const addressFieldNames = { "#addressLine1": "addressLine1", "#city": "city", "#state": "state", "#pincode": "pincode" };
  let businessType: "individual" | "business" = "individual";

  try {
    if (action === "approve" || action === "reject") {
      // Need businessType to know which KYC document rows to purge below.
      const existing = await docClient.send(
        new QueryCommand({
          TableName: VENDORS_TABLE,
          KeyConditionExpression: "userId = :userId",
          ExpressionAttributeValues: { ":userId": userId },
        })
      ).catch(() => null);
      businessType = (existing?.Items?.[0]?.businessType as "individual" | "business") || "individual";
    }

    if (action === "approve") {
      await docClient.send(
        new UpdateCommand({
          TableName: VENDORS_TABLE,
          Key: { userId },
          UpdateExpression:
            "SET kycStatus = :status, reviewedAt = :now, reviewedBy = :by REMOVE rejectionReason, #addressLine1, #city, #state, #pincode",
          ExpressionAttributeNames: addressFieldNames,
          ExpressionAttributeValues: { ":status": "verified", ":now": new Date().toISOString(), ":by": admin.email },
        })
      );
    } else if (action === "reject") {
      await docClient.send(
        new UpdateCommand({
          TableName: VENDORS_TABLE,
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
    } else if (action === "suspend" || action === "unsuspend") {
      await docClient.send(
        new UpdateCommand({
          TableName: VENDORS_TABLE,
          Key: { userId },
          UpdateExpression: "SET suspended = :s, updatedAt = :now",
          ExpressionAttributeValues: { ":s": action === "suspend", ":now": new Date().toISOString() },
        })
      );
    }
  } catch (err) {
    console.error(`admin/hammart-vendors: ${action} failed for ${userId}:`, err);
    return NextResponse.json({ error: "Couldn't save that right now." }, { status: 500 });
  }

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action:
      action === "approve"
        ? "vendor.kyc_approve"
        : action === "reject"
        ? "vendor.kyc_reject"
        : action === "suspend"
        ? "vendor.suspend"
        : "vendor.unsuspend",
    targetType: "vendor",
    targetId: userId,
    details: action === "reject" ? reason.trim() : undefined,
  });

  if (action === "approve" || action === "reject") {
    try {
      await purgeDocuments(userId, businessType);
    } catch (err) {
      console.error(`admin/hammart-vendors: decision saved but document purge FAILED for ${userId}:`, err);
    }
  }

  return NextResponse.json({ success: true });
}
