import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getOrder, submitOrderFeedback, respondToOrderFeedback } from "@/app/lib/hammartOrders";
import { sendEmail } from "@/app/lib/ses";
import { resolveCognitoEmails } from "@/app/lib/cognitoClient";

// POST — the buyer leaves feedback or files a complaint about their own
// order. One note per order (a resubmit overwrites the previous one) —
// see app/lib/hammartOrders.ts's OrderFeedback comment for why this is a
// lightweight note channel, not a full ticketing thread.
export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { order } = await getOrder(orderId);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.buyerUserId !== user.userId) {
    return NextResponse.json({ error: "This isn't your order." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const type = body.type === "complaint" ? "complaint" : "feedback";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
  if (!message) return NextResponse.json({ error: "Please write a message." }, { status: 400 });

  await submitOrderFeedback(orderId, { type, message });

  const vendorEmailMap = await resolveCognitoEmails([order.vendorUserId]);
  const vendorEmail = vendorEmailMap.get(order.vendorUserId);
  if (vendorEmail) {
    const orderIdDisplay = order.orderId.slice(0, 8).toUpperCase();
    const kind = type === "complaint" ? "Complaint" : "Feedback";
    void sendEmail({
      to: vendorEmail,
      subject: `${type === "complaint" ? "⚠️" : "💬"} ${kind} on Order [${orderIdDisplay}] — ${order.productTitle}`,
      text: `${order.buyerName} left ${type === "complaint" ? "a complaint" : "feedback"} on order ${orderIdDisplay} (${order.productTitle}):\n\n"${message}"\n\nReply from your Orders Received page on InPlayer.`,
      html: `<h2>${kind} on Order ${orderIdDisplay}</h2><p><strong>${order.buyerName}</strong> wrote about <strong>${order.productTitle}</strong>:</p><blockquote style="border-left:3px solid #f97316;padding-left:12px;color:#333;">${message}</blockquote><p>Reply from your Orders Received page on InPlayer.</p>`,
    }).catch((err) => console.error("Failed to email vendor feedback notification:", err));
  } else {
    console.error(`hammart feedback ${orderId}: vendor ${order.vendorUserId} has no email on file, notification not sent`);
  }

  return NextResponse.json({ success: true });
}

// PATCH — the vendor responds to feedback/a complaint on one of their own
// orders. Responding also marks the note resolved.
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
    return NextResponse.json({ error: "This isn't your order to respond to." }, { status: 403 });
  }
  if (!order.feedback) {
    return NextResponse.json({ error: "This order has no feedback to respond to." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const response = typeof body.response === "string" ? body.response.trim().slice(0, 1000) : "";
  if (!response) return NextResponse.json({ error: "Please write a response." }, { status: 400 });

  await respondToOrderFeedback(orderId, response);

  if (order.buyerEmail) {
    const orderIdDisplay = order.orderId.slice(0, 8).toUpperCase();
    void sendEmail({
      to: order.buyerEmail,
      subject: `Reply from @${order.vendorId} on Order [${orderIdDisplay}] — ${order.productTitle}`,
      text: `@${order.vendorId} replied to your note on order ${orderIdDisplay} (${order.productTitle}):\n\n"${response}"`,
      html: `<h2>@${order.vendorId} replied to your order</h2><p>Regarding <strong>${order.productTitle}</strong> (Order ${orderIdDisplay}):</p><blockquote style="border-left:3px solid #f97316;padding-left:12px;color:#333;">${response}</blockquote>`,
    }).catch((err) => console.error("Failed to email buyer feedback response:", err));
  }

  return NextResponse.json({ success: true });
}
