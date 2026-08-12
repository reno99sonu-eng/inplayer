import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import {
  VENDORS_TABLE,
  VENDOR_KYC_DOCUMENTS_TABLE,
  vendorKycDocTypesFor,
  setVendorRazorpayAccount,
  type VendorKycDocType,
} from "@/app/lib/hammartVendors";
import { createLinkedAccount, fetchLinkedAccount } from "@/app/lib/razorpay";
import { resolveUsernames } from "@/app/lib/resolveUsernames";
import { resolveCognitoEmails } from "@/app/lib/cognitoClient";
import { logAdminAction } from "@/app/lib/auditLog";
import { notifyVendorPayoutsActive } from "@/app/lib/hammartVendors";

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

// Attempts to create (or, on retry, re-create) the vendor's Razorpay Route
// linked account from the KYC data they already submitted — called right
// after admin approval, and by the "retry_razorpay" action below for
// vendors who were approved before this feature existed or whose first
// attempt failed. Never throws: every caller just wants a best-effort
// attempt recorded via setVendorRazorpayAccount, not a failure that blocks
// the approval itself. This is purely an upgrade path, never a
// requirement to sell — see app/api/hammart/checkout/route.ts's header
// comment: a vendor without an "active" status here simply keeps using
// the direct-UPI checkout fallback, so a failure here just means the
// vendor stays on UPI until Reno (or the vendor) retries — never a
// payment with nowhere real to land.
async function attemptRazorpayOnboarding(vendorRow: Record<string, unknown>) {
  const userId = vendorRow.userId as string;
  const legalName = (vendorRow.legalName as string) || "";
  const panNumber = (vendorRow.panNumber as string) || "";
  const bankAccountNumber = (vendorRow.bankAccountNumber as string) || "";
  const bankIfsc = (vendorRow.bankIfsc as string) || "";
  const businessType = ((vendorRow.businessType as string) === "business" ? "business" : "individual") as
    | "individual"
    | "business";

  if (!legalName || !panNumber || !bankAccountNumber || !bankIfsc) {
    await setVendorRazorpayAccount(userId, {
      status: "failed",
      error: "Missing legal name, PAN, or bank details — KYC submission is incomplete.",
    });
    return;
  }

  const emailMap = await resolveCognitoEmails([userId]);
  const email = emailMap.get(userId);
  if (!email) {
    await setVendorRazorpayAccount(userId, {
      status: "failed",
      error: "Couldn't resolve this vendor's account email.",
    });
    return;
  }

  try {
    const account = await createLinkedAccount({
      // Deliberately InPlayer's own userId, NOT the public vendorId slug
      // (which can change — see hammartVendors.ts's uniqueness-reservation
      // comment) — this is what app/api/webhooks/razorpay/route.ts's
      // account.* handlers use via reference_id to map a Razorpay account
      // event straight back to a VENDORS_TABLE row keyed on userId,
      // without a lookup table in between.
      vendorId: userId,
      email,
      legalName,
      businessType,
      panNumber,
      bankAccountNumber,
      bankIfsc,
    });
    // Razorpay's own underwriting still has to review this before it's
    // actually payable — "created" here is NOT "active". See
    // app/lib/razorpay.ts's header comment.
    await setVendorRazorpayAccount(userId, {
      accountId: account.id,
      status: account.status === "activated" ? "active" : "pending",
      error: null,
    });
  } catch (err) {
    console.error(`admin/hammart-vendors: Razorpay linked account creation failed for ${userId}:`, err);
    await setVendorRazorpayAccount(userId, {
      status: "failed",
      error: err instanceof Error ? err.message : "Razorpay linked account creation failed.",
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const TABS = ["pending_review", "verified", "rejected", "not_started", "all"] as const;
  type Tab = (typeof TABS)[number];
  const tabParam = request.nextUrl.searchParams.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(tabParam || "")
    ? (tabParam as Tab)
    : "pending_review";

  // One unfiltered scan instead of a per-tab FilterExpression — needed so
  // `counts` below can report accurate totals for EVERY kyc status in a
  // single request, not just whichever tab happens to be open. Without
  // this, a vendor who registered a storefront but never submitted KYC
  // (kycStatus === "not_started") had NO tab at all that would ever show
  // them — the old filter only recognized "pending_review" / "verified" /
  // "rejected" — so that vendor was completely invisible here regardless
  // of which tab you checked. A verified vendor (the only kycStatus a
  // vendor can have while their listings are actually live — see
  // app/api/hammart/products/route.ts's kycStatus check) was always
  // findable under "Verified", but with no visible counts anywhere it was
  // easy to only ever look at the default "Pending" tab and conclude the
  // vendor didn't exist here at all.
  const allItems: Record<string, unknown>[] = [];
  try {
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await docClient.send(
        new ScanCommand({ TableName: VENDORS_TABLE, ExclusiveStartKey: exclusiveStartKey })
      );
      allItems.push(...((result.Items || []) as Record<string, unknown>[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
  } catch (err) {
    console.error("admin/hammart-vendors: scan failed (table may not exist yet):", err);
    return NextResponse.json({ items: [], tableMissing: true, counts: {} });
  }

  const kycStatusOf = (item: Record<string, unknown>): string =>
    (item.kycStatus as string) || "not_started";

  const counts = { pending_review: 0, verified: 0, rejected: 0, not_started: 0 };
  for (const item of allItems) {
    const s = kycStatusOf(item);
    if (s in counts) counts[s as keyof typeof counts] += 1;
  }

  const items = tab === "all" ? allItems : allItems.filter((item) => kycStatusOf(item) === tab);

  // Fall back to createdAt for the sort key — a "not_started" vendor has
  // never submitted KYC, so submittedAt is always empty for them.
  items.sort(
    (a, b) =>
      new Date((b.submittedAt as string) || (b.createdAt as string) || 0).getTime() -
      new Date((a.submittedAt as string) || (a.createdAt as string) || 0).getTime()
  );

  const usernames = await resolveUsernames(items.map((i) => i.userId as string));

  // Scan products and orders once to aggregate vendor stats
  const vendorProductsMap = new Map<string, number>();
  try {
    const prodRes = await docClient.send(new ScanCommand({ TableName: "Hammart-Products" }));
    (prodRes.Items || []).forEach((p) => {
      const vKey = (p.vendorUserId as string) || (p.vendorId as string);
      if (vKey) {
        vendorProductsMap.set(vKey, (vendorProductsMap.get(vKey) || 0) + 1);
      }
    });
  } catch (err) {
    console.error("admin/hammart-vendors: failed to scan products for stats:", err);
  }

  const vendorSalesMap = new Map<string, { count: number; revenue: number }>();
  try {
    const ordersRes = await docClient.send(new ScanCommand({ TableName: "Hammart-Orders" }));
    (ordersRes.Items || []).forEach((o) => {
      const vKey = (o.vendorUserId as string) || (o.vendorId as string);
      if (vKey) {
        const current = vendorSalesMap.get(vKey) || { count: 0, revenue: 0 };
        current.count += 1;
        current.revenue += Number(o.priceInr) || 0;
        vendorSalesMap.set(vKey, current);
      }
    });
  } catch (err) {
    console.error("admin/hammart-vendors: failed to scan orders for stats:", err);
  }

  const withDocs = await Promise.all(
    items.map(async (item) => {
      const userId = item.userId as string;
      const vendorId = (item.vendorId as string) || "";
      const businessType = (item.businessType as "individual" | "business") || "individual";
      let documents: Record<string, string> = {};
      if (kycStatusOf(item) === "pending_review") {
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

      const prodCount = (vendorProductsMap.get(userId) || 0) + (vendorId ? vendorProductsMap.get(vendorId) || 0 : 0);
      const salesData = vendorSalesMap.get(userId) || (vendorId ? vendorSalesMap.get(vendorId) : undefined) || { count: 0, revenue: 0 };

      return {
        userId,
        username: usernames.get(userId) || null,
        vendorId: item.vendorId || null,
        kycStatus: kycStatusOf(item),
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
        createdAt: item.createdAt || null,
        reviewedAt: item.reviewedAt || null,
        reviewedBy: item.reviewedBy || null,
        rejectionReason: item.rejectionReason || null,
        suspended: Boolean(item.suspended),
        razorpayAccountId: item.razorpayAccountId || null,
        razorpayAccountStatus: item.razorpayAccountStatus || "not_started",
        razorpayAccountError: item.razorpayAccountError || null,
        totalProducts: prodCount,
        totalSold: salesData.count,
        totalRevenueInr: salesData.revenue,
        documents,
      };
    })
  );

  return NextResponse.json({ items: withDocs, counts });
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
  if (!["approve", "reject", "suspend", "unsuspend", "retry_razorpay", "sync_razorpay"].includes(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  if (action === "reject" && !reason?.trim()) {
    return NextResponse.json({ error: "A reason is required to reject." }, { status: 400 });
  }

  // retry_razorpay (re-attempt linked-account creation for an already-
  // verified vendor whose first attempt failed, or who was approved
  // before this feature existed) and sync_razorpay (re-fetch the current
  // status directly from Razorpay, in case the account.activated webhook
  // event never arrived) both operate on a vendor row that's already
  // verified — they don't touch kycStatus at all, so they're handled and
  // returned separately from the approve/reject/suspend flow below.
  if (action === "retry_razorpay" || action === "sync_razorpay") {
    const existing = await docClient
      .send(
        new QueryCommand({
          TableName: VENDORS_TABLE,
          KeyConditionExpression: "userId = :userId",
          ExpressionAttributeValues: { ":userId": userId },
        })
      )
      .catch(() => null);
    const vendorRow = existing?.Items?.[0] as Record<string, unknown> | undefined;
    if (!vendorRow || vendorRow.kycStatus !== "verified") {
      return NextResponse.json({ error: "This vendor isn't KYC-verified yet." }, { status: 400 });
    }

    try {
      if (action === "sync_razorpay") {
        const existingAccountId = vendorRow.razorpayAccountId as string | undefined;
        if (!existingAccountId) {
          return NextResponse.json({ error: "No Razorpay account has been created for this vendor yet — use Retry instead." }, { status: 400 });
        }
        const account = await fetchLinkedAccount(existingAccountId);
        const newStatus = account.status === "activated" ? "active" : account.status === "suspended" ? "failed" : "pending";
        const wasActive = vendorRow.razorpayAccountStatus === "active";
        await setVendorRazorpayAccount(userId, {
          status: newStatus,
          error: account.status === "activated" ? null : `Razorpay status: ${account.status}`,
        });
        // A manual "Check status" sync is exactly the scenario where the
        // account.activated webhook may have never arrived — this is often
        // the FIRST time anyone (InPlayer or the vendor) learns the account
        // just went active, so it gets the same notification email the
        // webhook path sends.
        if (newStatus === "active" && !wasActive) {
          await notifyVendorPayoutsActive(userId);
        }
      } else {
        await attemptRazorpayOnboarding(vendorRow);
      }
    } catch (err) {
      console.error(`admin/hammart-vendors: ${action} failed for ${userId}:`, err);
      return NextResponse.json({ error: "Couldn't reach Razorpay right now." }, { status: 502 });
    }

    await logAdminAction({
      request,
      adminId: admin.userId,
      adminEmail: admin.email,
      action: action === "retry_razorpay" ? "vendor.razorpay_retry" : "vendor.razorpay_sync",
      targetType: "vendor",
      targetId: userId,
    });

    return NextResponse.json({ success: true });
  }

  const addressFieldNames = { "#addressLine1": "addressLine1", "#city": "city", "#state": "state", "#pincode": "pincode" };
  let businessType: "individual" | "business" = "individual";
  let approvedVendorRow: Record<string, unknown> | undefined;

  try {
    if (action === "approve" || action === "reject") {
      // Need businessType to know which KYC document rows to purge below,
      // and (for "approve") the full row to onboard onto Razorpay Route —
      // read BEFORE the update below, since bank/PAN/legal-name fields
      // stay on the row afterward but this is the natural point to grab
      // them together with everything else already being fetched here.
      const existing = await docClient.send(
        new QueryCommand({
          TableName: VENDORS_TABLE,
          KeyConditionExpression: "userId = :userId",
          ExpressionAttributeValues: { ":userId": userId },
        })
      ).catch(() => null);
      approvedVendorRow = existing?.Items?.[0] as Record<string, unknown> | undefined;
      businessType = (approvedVendorRow?.businessType as "individual" | "business") || "individual";
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

  // Fire-and-forget from the response's perspective, but genuinely
  // awaited here — the admin's "Approve" click should reflect the real
  // outcome (including a Razorpay failure) the moment it returns, rather
  // than approving instantly and leaving onboarding to a background
  // process the admin has no visibility into. attemptRazorpayOnboarding
  // itself never throws (see its own comment), so this can't turn a
  // successful KYC approval into a 500.
  if (action === "approve" && approvedVendorRow) {
    await attemptRazorpayOnboarding(approvedVendorRow);
  }

  return NextResponse.json({ success: true });
}
