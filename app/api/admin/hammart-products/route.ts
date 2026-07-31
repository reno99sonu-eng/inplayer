import { NextRequest, NextResponse } from "next/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { PRODUCTS_TABLE, setProductStatus, type HammartProduct } from "@/app/lib/hammartProducts";
import { resolveUsernames } from "@/app/lib/resolveUsernames";
import { logAdminAction } from "@/app/lib/auditLog";

// Admin moderation queue for Hammart listings — separate from the vendor
// KYC queue (app/api/admin/hammart-vendors/route.ts). This is the missing
// piece that actually lets an admin act on HammartProduct.status ===
// "admin_removed"/flagged, which existed in app/lib/hammartProducts.ts
// from the start but had no admin-facing route wired to it yet.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tabParam = request.nextUrl.searchParams.get("tab");
  const tab = tabParam === "removed" || tabParam === "all" ? tabParam : "flagged";

  let items: HammartProduct[] = [];
  try {
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await docClient.send(
        new ScanCommand({ TableName: PRODUCTS_TABLE, ExclusiveStartKey: exclusiveStartKey })
      );
      items.push(...((result.Items || []) as HammartProduct[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
  } catch (err) {
    console.error("admin/hammart-products: scan failed (table may not exist yet):", err);
    return NextResponse.json({ items: [], tableMissing: true });
  }

  if (tab === "flagged") {
    items = items.filter((p) => p.flagged && p.status !== "admin_removed");
  } else if (tab === "removed") {
    items = items.filter((p) => p.status === "admin_removed");
  }
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const usernames = await resolveUsernames(items.map((p) => p.vendorUserId));
  const withUsernames = items.map((p) => ({ ...p, vendorUsername: usernames.get(p.vendorUserId) || null }));

  return NextResponse.json({ items: withUsernames });
}

export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { productId, action } = body;

  if (!productId || typeof productId !== "string") {
    return NextResponse.json({ error: "productId is required." }, { status: 400 });
  }
  if (action !== "remove" && action !== "restore") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  try {
    await setProductStatus(productId, action === "remove" ? "admin_removed" : "active");
  } catch (err) {
    console.error(`admin/hammart-products: ${action} failed for ${productId}:`, err);
    return NextResponse.json({ error: "Couldn't save that right now." }, { status: 500 });
  }

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: action === "remove" ? "hammart_product.remove" : "hammart_product.restore",
    targetType: "hammart_product",
    targetId: productId,
  });

  return NextResponse.json({ success: true });
}
