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
  const buyerPhone = typeof body.buyerPhone === "string" ? body.buyerPhone.trim().slice(0, 20) : "";
  const deliveryAddress = typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim().slice(0, 300) : "";
  const city = typeof body.city === "string" ? body.city.trim().slice(0, 60) : "";
  const state = typeof body.state === "string" ? body.state.trim().slice(0, 60) : "";
  const pincode = typeof body.pincode === "string" ? body.pincode.trim().slice(0, 10) : "";
  const customName = typeof body.buyerName === "string" ? body.buyerName.trim().slice(0, 100) : "";
  const customEmail = typeof body.buyerEmail === "string" ? body.buyerEmail.trim().slice(0, 120) : "";

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

  const buyerName = customName || user.name || "InPlayer Customer";
  const buyerEmail = customEmail || user.email || "";

  const result = await createOrder({
    productId: product.productId,
    productTitle: product.title,
    productImageUrl: product.imageUrl,
    priceInr: product.priceInr,
    buyerUserId: user.userId,
    buyerName,
    buyerEmail,
    buyerPhone,
    deliveryAddress,
    city,
    state,
    pincode,
    vendorUserId: vendor.userId,
    vendorId: vendor.vendorId,
    vendorUpiId: vendor.upiId,
  });

  if (!result.success || !result.order) {
    return NextResponse.json({ error: "Couldn't place your order right now.", tableMissing: result.tableMissing }, { status: 503 });
  }

  const orderIdDisplay = result.order.orderId.slice(0, 8).toUpperCase();

  // Send Buyer Confirmation Email to Customer's Primary Email Address
  if (buyerEmail) {
    void sendEmail({
      to: buyerEmail,
      subject: `Hammart Order Confirmed [${orderIdDisplay}] — ${product.title}`,
      text: `Order ID: ${orderIdDisplay}\nYou placed an order for "${product.title}" (₹${product.priceInr}) from vendor @${vendor.vendorId}.\n\nPayment Note: Pay the vendor directly via UPI ID ${vendor.upiId}. InPlayer does not process this payment directly.\n\nYour shipping address was sent directly to the vendor for fulfillment.`,
      html: `<h2>Order Confirmed — ${orderIdDisplay}</h2><p>You placed an order for <strong>${product.title}</strong> (₹${product.priceInr}) from vendor <strong>@${vendor.vendorId}</strong>.</p><p><strong>Payment Note:</strong> Pay the vendor directly via UPI ID <strong>${vendor.upiId}</strong>. InPlayer does not process this transaction.</p><p>Your delivery address has been sent directly to the vendor for shipment.</p>`,
    }).catch((err) => console.error("Failed to email buyer order confirmation:", err));
  }

  // Send Direct Email Notification to Vendor with Order ID, Customer Name, Email, Phone, & Full Address
  const vendorEmailMap = await resolveCognitoEmails([vendor.userId]);
  const vendorEmail = vendorEmailMap.get(vendor.userId);
  if (vendorEmail) {
    const fullAddress = [deliveryAddress, city, state, pincode].filter(Boolean).join(", ");
    void sendEmail({
      to: vendorEmail,
      subject: `🚨 New Hammart Order [ID: ${orderIdDisplay}] — ${product.title}`,
      text: `NEW ORDER RECEIVED!\n\nOrder ID: ${orderIdDisplay}\nProduct: ${product.title}\nPrice: ₹${product.priceInr}\n\nCUSTOMER DETAILS:\n- Name: ${buyerName}\n- Email: ${buyerEmail || "Not provided"}\n- Phone: ${buyerPhone || "Not provided"}\n- Delivery Address: ${fullAddress || "Direct Contact"}\n\nNote: Buyer will pay you directly to your UPI ID (${vendor.upiId}). Fulfill and ship order to the customer's address above.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #f97316;">🎉 New Hammart Order Received!</h2>
          <p><strong>Order ID:</strong> ${orderIdDisplay}</p>
          <hr style="border: 0; border-top: 1px solid #eee;" />
          <h3>🛒 Item Details:</h3>
          <p><strong>Product:</strong> ${product.title}<br/><strong>Price:</strong> ₹${product.priceInr}</p>
          <hr style="border: 0; border-top: 1px solid #eee;" />
          <h3>👤 Customer Delivery Information:</h3>
          <p>
            <strong>Customer Name:</strong> ${buyerName}<br/>
            <strong>Email:</strong> ${buyerEmail || "Not provided"}<br/>
            <strong>Phone Number:</strong> ${buyerPhone || "Not provided"}<br/>
            <strong>Shipping Address:</strong> ${fullAddress || "Contact buyer directly"}
          </p>
          <hr style="border: 0; border-top: 1px solid #eee;" />
          <p style="background: #fff7ed; padding: 12px; border-radius: 8px; border: 1px solid #ffedd5; color: #c2410c;">
            <strong>💳 Payment Note:</strong> Customer pays you directly via your UPI ID (<strong>${vendor.upiId}</strong>). InPlayer does not process this transaction.
          </p>
        </div>
      `,
    }).catch((err) => console.error("Failed to email vendor order notification:", err));
  } else {
    console.error(`hammart order ${result.order.orderId}: vendor ${vendor.userId} has no email on file, notification not sent`);
  }

  return NextResponse.json({ success: true, order: result.order });
}
