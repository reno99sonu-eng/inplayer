import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getVendorProfile, VENDORS_TABLE, FREE_LISTINGS_LIMIT } from "@/app/lib/hammartVendors";
import { createProduct, listActiveProducts } from "@/app/lib/hammartProducts";
import { checkBannedProduct, UNCHECKED_BANNED_ITEM } from "@/app/lib/hammartModeration";
import { THUMBNAIL_DATA_URL_MAX_LENGTH } from "@/app/lib/imageCompress";
import { getPlatformSettings } from "@/app/lib/platformSettings";

const MAX_IMAGE_LENGTH = THUMBNAIL_DATA_URL_MAX_LENGTH * 1.2;

// GET /api/hammart/products — public storefront browse (only real, live,
// unflagged listings from verified, non-suspended vendors). Supports filtering by vendorId.
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category") || undefined;
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;

  const { products: allProducts, tableMissing } = await listActiveProducts({ category });
  const products = vendorId
    ? allProducts.filter((p) => p.vendorId === vendorId || p.vendorUserId === vendorId)
    : allProducts;
  return NextResponse.json({ products, tableMissing });
}

// POST /api/hammart/products — a verified, non-suspended vendor publishes
// a new listing. Enforces the real 10-free-then-₹249/month quota and runs
// the banned-item AI check before anything goes live — a flagged listing
// is still created (so the vendor sees it and can appeal), just hidden
// from the public storefront immediately.
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { vendor } = await getVendorProfile(user.userId);
  if (!vendor) {
    return NextResponse.json({ error: "Register as a Hammart vendor first." }, { status: 400 });
  }
  if (vendor.suspended) {
    return NextResponse.json({ error: "Your vendor account is suspended." }, { status: 403 });
  }
  if (vendor.kycStatus !== "verified") {
    return NextResponse.json({ error: "Complete business verification (KYC) before publishing listings." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 150) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 3000) : "";
  const details = typeof body.details === "string" ? body.details.trim().slice(0, 3000) : "";
  const hsCode = typeof body.hsCode === "string" ? body.hsCode.trim().slice(0, 30) : "";
  const countryOfOrigin = typeof body.countryOfOrigin === "string" ? body.countryOfOrigin.trim().slice(0, 60) : "India";
  const category = typeof body.category === "string" ? body.category.trim().slice(0, 60) : "";
  const priceInr = Number(body.priceInr);

  const rawImageUrls = Array.isArray(body.imageUrls) ? body.imageUrls : [];
  const imageUrls: string[] = rawImageUrls.filter((url: unknown): url is string => typeof url === "string" && url.startsWith("data:image/"));
  const imageUrl = imageUrls.length > 0 ? imageUrls[0] : (typeof body.imageUrl === "string" ? body.imageUrl : null);

  if (!title || !description || !category) {
    return NextResponse.json({ error: "Please fill in title, description, and category." }, { status: 400 });
  }
  if (!Number.isFinite(priceInr) || priceInr < 1 || priceInr > 10_000_000) {
    return NextResponse.json({ error: "Please enter a valid price." }, { status: 400 });
  }

  // Hammart's own AI Moderation toggle (Admin Panel -> Hammart ->
  // AI Moderation), independent from InPlayer's three content toggles —
  // previously this check always ran unconditionally with no way to turn
  // it off. Off means the same UNCHECKED_BANNED_ITEM result the real check
  // itself already falls back to on any error/timeout, so this reuses that
  // exact fail-open shape instead of inventing a second one.
  const { hammartModerationEnabledListings } = await getPlatformSettings();
  const moderation = hammartModerationEnabledListings
    ? await checkBannedProduct({ title, description, category })
    : UNCHECKED_BANNED_ITEM;

  const result = await createProduct({
    vendorUserId: user.userId,
    vendorId: vendor.vendorId,
    title,
    description,
    details,
    hsCode,
    countryOfOrigin,
    category,
    priceInr,
    imageUrl,
    imageUrls: imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : []),
    flagged: moderation.checked && moderation.banned,
    flaggedCategory: moderation.category,
    flaggedReason: moderation.reason,
  });

  if (!result.success) {
    return NextResponse.json({ error: "Listings aren't available yet — please try again shortly.", tableMissing: result.tableMissing }, { status: 503 });
  }

  // Increment total listings count for the vendor profile
  await docClient.send(
    new UpdateCommand({
      TableName: VENDORS_TABLE,
      Key: { userId: user.userId },
      UpdateExpression: "ADD freeListingsUsed :one SET updatedAt = :now",
      ExpressionAttributeValues: { ":one": 1, ":now": new Date().toISOString() },
    })
  ).catch((err) => console.error("Failed to increment vendor listings count:", err));

  return NextResponse.json({
    success: true,
    product: result.product,
    flagged: result.product?.flagged || false,
  });
}
