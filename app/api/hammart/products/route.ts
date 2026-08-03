import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getVendorProfile, VENDORS_TABLE, FREE_LISTINGS_LIMIT } from "@/app/lib/hammartVendors";
import { createProduct, listActiveProducts } from "@/app/lib/hammartProducts";
import { checkBannedProduct } from "@/app/lib/hammartModeration";
import { THUMBNAIL_DATA_URL_MAX_LENGTH } from "@/app/lib/imageCompress";

const MAX_IMAGE_LENGTH = THUMBNAIL_DATA_URL_MAX_LENGTH * 1.2;

// GET /api/hammart/products — public storefront browse (only real, live,
// unflagged listings from verified, non-suspended vendors).
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category") || undefined;
  const { products, tableMissing } = await listActiveProducts({ category });
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

  // Hammart Listing Model: Unlimited listings for all verified vendors at ₹0.50 per product listing fee

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 150) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 3000) : "";
  const category = typeof body.category === "string" ? body.category.trim().slice(0, 60) : "";
  const priceInr = Number(body.priceInr);
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : null;

  if (!title || !description || !category) {
    return NextResponse.json({ error: "Please fill in title, description, and category." }, { status: 400 });
  }
  if (!Number.isFinite(priceInr) || priceInr < 1 || priceInr > 10_000_000) {
    return NextResponse.json({ error: "Please enter a valid price." }, { status: 400 });
  }
  if (imageUrl && (!imageUrl.startsWith("data:image/") || imageUrl.length > MAX_IMAGE_LENGTH)) {
    return NextResponse.json({ error: "Please upload a valid product photo." }, { status: 400 });
  }

  const moderation = await checkBannedProduct({ title, description, category });

  const result = await createProduct({
    vendorUserId: user.userId,
    vendorId: vendor.vendorId,
    title,
    description,
    category,
    priceInr,
    imageUrl,
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
