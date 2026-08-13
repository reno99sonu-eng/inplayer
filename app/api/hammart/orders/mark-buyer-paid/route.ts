import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getOrder, markBuyerClaimedPaid, type HammartOrder } from "@/app/lib/hammartOrders";
import { orderTotalInr } from "@/app/lib/hammartOrderMath";
import { resolveCognitoEmails } from "@/app/lib/cognitoClient";
import { sendEmail } from "@/app/lib/ses";

// "I've completed this payment" — the buyer-side nudge button on the
// direct-UPI checkout results screen (app/shop/cart/page.tsx,
// app/shop/product/[productId]/page.tsx). This does NOT mark anything
// paid — only the vendor's own confirmation
// (app/api/hammart/orders/[orderId]/route.ts) can do that, same trust
// model this path has always used (see app/lib/hammartOrders.ts's header
// comment). All this does is record when the buyer says they paid, and
// email the vendor right away so they check their UPI app sooner instead
// of only finding out whenever they next happen to open Orders Received.
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const orderIds: string[] = Array.isArray(body.orderIds)
    ? body.orderIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  if (orderIds.length === 0) {
    return NextResponse.json({ error: "orderIds is required." }, { status: 400 });
  }

  // Group by vendor so a multi-item order from the same seller sends ONE
  // nudge email, not one per line — same "one payment per vendor group"
  // shape checkout itself already uses.
  const newlyClaimedByVendor = new Map<string, { vendorUserId: string; orders: HammartOrder[] }>();

  for (const orderId of orderIds) {
    const { order } = await getOrder(orderId);
    // Silently skip anything that isn't this buyer's own order, or isn't
    // actually on the direct-UPI path awaiting payment — never error the
    // whole batch over one bad id, and never let this become a way to
    // probe other people's orders.
    if (!order || order.buyerUserId !== user.userId || order.status !== "placed") continue;
    // Idempotent — a buyer re-clicking (or a page re-render firing twice)
    // shouldn't re-email the vendor every time.
    if (order.buyerClaimedPaidAt) continue;

    await markBuyerClaimedPaid(orderId).catch((err) =>
      console.error(`mark-buyer-paid: failed to record claim for ${orderId}:`, err)
    );

    const existing = newlyClaimedByVendor.get(order.vendorUserId);
    if (existing) existing.orders.push(order);
    else newlyClaimedByVendor.set(order.vendorUserId, { vendorUserId: order.vendorUserId, orders: [order] });
  }

  if (newlyClaimedByVendor.size > 0) {
    const vendorUserIds = Array.from(newlyClaimedByVendor.keys());
    const emailMap = await resolveCognitoEmails(vendorUserIds).catch(() => new Map<string, string>());

    await Promise.all(
      Array.from(newlyClaimedByVendor.values()).map(async ({ vendorUserId, orders }) => {
        const vendorEmail = emailMap.get(vendorUserId);
        if (!vendorEmail) return;
        const total = orders.reduce((sum, o) => sum + orderTotalInr(o), 0);
        const itemLines = orders.map((o) => `- ${o.productTitle} (₹${o.priceInr}${(o.quantity ?? 1) > 1 ? ` × ${o.quantity}` : ""})`).join("\n");
        const orderIdsDisplay = orders.map((o) => o.orderId.slice(0, 8).toUpperCase()).join(", ");
        await sendEmail({
          to: vendorEmail,
          subject: `💰 A buyer says they've paid — order [${orderIdsDisplay}]`,
          text: `A buyer says they've completed UPI payment for:\n${itemLines}\n\nTotal: ₹${total.toLocaleString("en-IN")}\n\nPlease check your UPI app or bank statement, and confirm the order from your Orders Received page once you've verified the money actually arrived.`,
          html: `<p>A buyer says they've completed UPI payment for:</p><pre>${itemLines}</pre><p><strong>Total:</strong> ₹${total.toLocaleString("en-IN")}</p><p>Please check your UPI app or bank statement, and confirm the order from your Orders Received page once you've verified the money actually arrived.</p>`,
        }).catch((err) => console.error(`mark-buyer-paid: vendor nudge email failed for ${vendorUserId}:`, err));
      })
    );
  }

  return NextResponse.json({ success: true });
}
