import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { listAllOrdersForAdmin, type OrderStatus } from "@/app/lib/hammartOrders";
import { orderTotalInr } from "@/app/lib/hammartOrderMath";

// Read-only view of every Hammart order across every vendor — the admin
// counterpart to a vendor's own Orders Received page
// (app/shop/vendor/orders/page.tsx), which only ever shows that one
// vendor's orders. This is a full picture for Reno: which orders are
// sitting on the direct-UPI path awaiting a vendor's confirmation, which
// went through Razorpay, and so on — nothing here can change an order's
// status (that stays exactly where it already was: the vendor's own
// confirmation, or Razorpay's verified webhook).
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orders, tableMissing } = await listAllOrdersForAdmin();
  if (tableMissing) {
    return NextResponse.json({ items: [], tableMissing: true, counts: {} });
  }

  const counts: Record<string, number> = {};
  for (const o of orders) {
    counts[o.status] = (counts[o.status] || 0) + 1;
  }

  const TABS: (OrderStatus | "all")[] = [
    "placed",
    "payment_pending",
    "paid",
    "vendor_confirmed",
    "payment_failed",
    "vendor_cancelled",
    "all",
  ];
  const tabParam = request.nextUrl.searchParams.get("tab");
  const tab = (TABS as string[]).includes(tabParam || "") ? (tabParam as OrderStatus | "all") : "all";
  const filtered = tab === "all" ? orders : orders.filter((o) => o.status === tab);

  const items = filtered.map((o) => ({
    orderId: o.orderId,
    productTitle: o.productTitle,
    productImageUrl: o.productImageUrl,
    priceInr: o.priceInr,
    quantity: o.quantity || 1,
    totalInr: orderTotalInr(o),
    buyerName: o.buyerName,
    buyerEmail: o.buyerEmail,
    vendorId: o.vendorId,
    vendorUserId: o.vendorUserId,
    status: o.status,
    paymentMethod: o.razorpayOrderId ? "razorpay" : "upi",
    buyerClaimedPaidAt: o.buyerClaimedPaidAt || null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }));

  return NextResponse.json({ items, counts });
}
