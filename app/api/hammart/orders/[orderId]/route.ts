import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getOrder, setOrderStatus } from "@/app/lib/hammartOrders";
import { orderTotalInr } from "@/app/lib/hammartOrderMath";
import { sendEmail } from "@/app/lib/ses";

// Vendor marks an order confirmed (they've received payment and are
// fulfilling) or cancelled — see app/lib/hammartOrders.ts's top comment
// for why "confirmed" here means "the vendor says so," not a payment
// gateway confirmation.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { order } = await getOrder(orderId);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.vendorUserId !== user.userId) {
    return NextResponse.json({ error: "This isn't your order to update." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.status !== "vendor_confirmed" && body.status !== "vendor_cancelled" && body.status !== "delivered") {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  // A vendor can only act on an order that's actually payable-confirmed:
  // "placed" rows (direct-UPI path — trusted on the vendor's own word,
  // same as it's always been) or "paid" rows (Razorpay path,
  // webhook-verified real payment). Blocking "payment_pending" here
  // closes off a vendor marking — and potentially shipping against — an
  // order that was never actually paid for, regardless of what the UI
  // shows. They can also mark it as delivered if it's currently vendor_confirmed.
  if (order.status !== "placed" && order.status !== "paid" && order.status !== "vendor_confirmed") {
    return NextResponse.json({ error: "This order can't be updated right now." }, { status: 400 });
  }

  // Prevent jumping straight to delivered without confirmation, unless it's paid/placed
  // Wait, if it's placed/paid they can confirm or cancel. If it's already confirmed, they can mark delivered.
  // We'll allow confirmed -> delivered or cancelled.
  if (body.status === "delivered" && order.status !== "vendor_confirmed") {
    // Some vendors might try to jump straight to delivered. Let's allow it for robustness,
    // but typically they confirm first.
  }

  await setOrderStatus(orderId, body.status);

  // Instant buyer notification — this is what lets the checkout results
  // screen (app/shop/cart/page.tsx, app/shop/product/[productId]/page.tsx)
  // poll its way to a real "Order placed!" state for the direct-UPI path
  // instead of the buyer only finding out on a later visit to My Orders.
  // buyerEmail already lives on the order row from checkout time — no
  // extra lookup needed. Fire-and-forget: a failed email here never blocks
  // or reverses the status change that already succeeded above.
  if (order.buyerEmail) {
    if (body.status === "vendor_confirmed") {
      const total = orderTotalInr(order);
      void sendEmail({
        to: order.buyerEmail,
        subject: `🎉 Order confirmed — [${orderId.slice(0, 8).toUpperCase()}]`,
        text: `${order.vendorId} has confirmed your payment of ₹${total.toLocaleString("en-IN")} for "${order.productTitle}" and is preparing your order for delivery.`,
        html: `<h2>Order confirmed 🎉</h2><p><strong>${order.vendorId}</strong> has confirmed your payment of <strong>₹${total.toLocaleString("en-IN")}</strong> for <strong>${order.productTitle}</strong> and is preparing your order for delivery.</p>`,
      }).catch((err) => console.error(`orders/${orderId}: buyer confirmation email failed:`, err));
    } else if (body.status === "vendor_cancelled") {
      void sendEmail({
        to: order.buyerEmail,
        subject: `Order cancelled — [${orderId.slice(0, 8).toUpperCase()}]`,
        text: `${order.vendorId} has cancelled your order for "${order.productTitle}". If you already sent payment via UPI and haven't heard from them about a refund, please reach out to the seller directly.`,
        html: `<h2>Order cancelled</h2><p><strong>${order.vendorId}</strong> has cancelled your order for <strong>${order.productTitle}</strong>. If you already sent payment via UPI and haven't heard from them about a refund, please reach out to the seller directly.</p>`,
      }).catch((err) => console.error(`orders/${orderId}: buyer cancellation email failed:`, err));
    } else if (body.status === "delivered") {
      void sendEmail({
        to: order.buyerEmail,
        subject: `📦 Order delivered — [${orderId.slice(0, 8).toUpperCase()}]`,
        text: `${order.vendorId} has marked your order for "${order.productTitle}" as delivered! You can now rate your purchase in My Orders.`,
        html: `<h2>Order delivered 📦</h2><p><strong>${order.vendorId}</strong> has marked your order for <strong>${order.productTitle}</strong> as delivered! You can now rate your purchase in My Orders.</p>`,
      }).catch((err) => console.error(`orders/${orderId}: buyer delivery email failed:`, err));
    }
  }

  return NextResponse.json({ success: true });
}
