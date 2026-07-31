import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getProduct } from "@/app/lib/hammartProducts";
import { getVendorProfile } from "@/app/lib/hammartVendors";
import { createOrder, listBuyerOrders, listVendorOrders } from "@/app/lib/hammartOrders";
import { sendEmail } from "@/app/lib/ses";
import { resolveCognitoEmails } from "@/app/lib/cognitoClient";

// GET /api/hammart/orders — your own orders as a buyer, or (with
// ?role=vendor) the orders placed against your own vendor listings.
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const role = request.nextUrl.searchParams.get("role");
  const { orders, tableMissing } = role === "vendor" ? await listVendorOrders(user.userId) : await listBuyerOrders(user.userId);
  return NextResponse.json({ orders, tableMissing });
}

// POST /api/hammart/orders — buyer places an order. Records the claim and
// emails the vendor — see app/lib/hammartOrders.ts's top comment for why
// this is NOT proof of payment (money moves buyer -> vendor directly over
// UPI, InPlayer's server never sees it).
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const productId = typeof body.productId === "string" ? body.productId : "";
  if (!productId) return NextResponse.json({ error: "productId is required." }, { status: 400 });

  const { product } = await getProduct(productId);
  if (!product || product.status !== "active") {
    return NextResponse.json({ error: "This listing is no longer available." }, { status: 404 });
  }
  if (product.vendorUserId === user.userId) {
    return NextResponse.json({ error: "You can't buy your own listing." }, { status: 400 });
  }

  const { vendor } = await getVendorProfile(product.vendorUserId);
  if (!vendor || vendor.suspended || !vendor.upiId) {
    return NextResponse.json({ error: "This vendor can't accept orders right now." }, { status: 400 });
  }

  const result = await createOrder({
    productId: product.productId,
    productTitle: product.title,
    productImageUrl: product.imageUrl,
    priceInr: product.priceInr,
    buyerUserId: user.userId,
    buyerName: user.name || "InPlayer user",
    buyerEmail: user.email || "",
    vendorUserId: vendor.userId,
    vendorId: vendor.vendorId,
    vendorUpiId: vendor.upiId,
  });

  if (!result.success || !result.order) {
    return NextResponse.json({ error: "Couldn't place your order right now.", tableMissing: result.tableMissing }, { status: 503 });
  }

  // Best-effort — a failed notification email never blocks the order
  // itself from being recorded (same fire-and-forget convention as every
  // other notification path in this codebase).
  if (user.email) {
    void sendEmail({
      to: user.email,
      subject: `Your Hammart order — ${product.title}`,
      text: `You placed an order for "${product.title}" (₹${product.priceInr}) from ${vendor.vendorId}. Pay them directly via UPI ID ${vendor.upiId} if you haven't already — InPlayer doesn't process this payment.`,
      html: `<p>You placed an order for <strong>${product.title}</strong> (₹${product.priceInr}) from <strong>${vendor.vendorId}</strong>.</p><p>Pay them directly via UPI ID <strong>${vendor.upiId}</strong> if you haven't already — InPlayer doesn't process this payment.</p>`,
    }).catch((err) => console.error("Failed to email buyer order confirmation:", err));
  }

  // The real point of this whole endpoint, per Reno's spec: the vendor
  // gets emailed the instant an order comes in, at the email they signed
  // up with. VendorProfile itself never stores an email (InPlayer-Users
  // doesn't either) — Cognito is the one real source of truth for it, see
  // app/lib/cognitoClient.ts.
  const vendorEmailMap = await resolveCognitoEmails([vendor.userId]);
  const vendorEmail = vendorEmailMap.get(vendor.userId);
  if (vendorEmail) {
    void sendEmail({
      to: vendorEmail,
      subject: `New Hammart order — ${product.title}`,
      text: `${result.order.buyerName} ordered "${product.title}" (₹${product.priceInr}). They've been shown your UPI ID (${vendor.upiId}) to pay directly. Check your Vendor Dashboard on InPlayer for order details.`,
      html: `<p><strong>${result.order.buyerName}</strong> ordered <strong>${product.title}</strong> (₹${product.priceInr}).</p><p>They've been shown your UPI ID (<strong>${vendor.upiId}</strong>) to pay you directly. Check your Vendor Dashboard on InPlayer for order details.</p>`,
    }).catch((err) => console.error("Failed to email vendor order notification:", err));
  } else {
    console.error(`hammart order ${result.order.orderId}: vendor ${vendor.userId} has no email on file, notification not sent`);
  }

  return NextResponse.json({ success: true, order: result.order });
}
