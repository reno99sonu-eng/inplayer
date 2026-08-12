import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { listBuyerOrders, listVendorOrders } from "@/app/lib/hammartOrders";

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

// POST removed — this endpoint used to create an unpaid "placed" order
// against a vendor's own UPI ID, with no server-side payment verification
// at all. That flow is superseded by POST /api/hammart/checkout (real
// Razorpay Route order + transfer, gated on the vendor's Razorpay account
// being "active"). Deliberately not kept as a fallback: leaving this route
// live would be a way to create a real order with no payment-safety gate
// behind it at all, which is exactly what Hammart's payment overhaul was
// built to eliminate. Any request to POST here now gets a 410.
export async function POST() {
  return NextResponse.json(
    { error: "This checkout method is no longer available. Please use the current checkout flow." },
    { status: 410 }
  );
}
