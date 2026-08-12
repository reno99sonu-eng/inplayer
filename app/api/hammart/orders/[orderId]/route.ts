import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getOrder, setOrderStatus } from "@/app/lib/hammartOrders";

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
  if (body.status !== "vendor_confirmed" && body.status !== "vendor_cancelled") {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  // A vendor can only act on an order that's actually payable-confirmed:
  // "placed" rows (direct-UPI path — trusted on the vendor's own word,
  // same as it's always been) or "paid" rows (Razorpay path,
  // webhook-verified real payment). Blocking "payment_pending" here
  // closes off a vendor marking — and potentially shipping against — an
  // order that was never actually paid for, regardless of what the UI
  // shows.
  if (order.status !== "placed" && order.status !== "paid") {
    return NextResponse.json({ error: "This order can't be updated right now." }, { status: 400 });
  }

  await setOrderStatus(orderId, body.status);
  return NextResponse.json({ success: true });
}
