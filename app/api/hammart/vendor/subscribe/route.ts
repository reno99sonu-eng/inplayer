import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { createVendorSubscription } from "@/app/lib/razorpay";
import { getVendorProfile } from "@/app/lib/hammartVendors";

// Starts the vendor's own ₹249/month platform-fee subscription (needed
// once they've used their 10 free listings) — same "create a live
// Razorpay Subscription, don't mark anything active until the webhook
// actually confirms a payment" shape as app/api/memberships/subscribe.
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const planId = process.env.RAZORPAY_HAMMART_VENDOR_PLAN_ID;
  if (!planId) {
    return NextResponse.json(
      { error: "Vendor subscriptions aren't configured yet — missing RAZORPAY_HAMMART_VENDOR_PLAN_ID." },
      { status: 503 }
    );
  }

  const { vendor } = await getVendorProfile(user.userId);
  if (!vendor) {
    return NextResponse.json({ error: "Register as a vendor first." }, { status: 400 });
  }
  if (vendor.kycStatus !== "verified") {
    return NextResponse.json({ error: "Complete KYC verification before subscribing." }, { status: 400 });
  }
  if (vendor.subscriptionStatus === "active") {
    return NextResponse.json({ alreadyActive: true });
  }

  let subscription;
  try {
    subscription = await createVendorSubscription({ planId, vendorId: user.userId });
  } catch (err) {
    console.error("hammart vendor subscribe: Razorpay subscription creation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't start your subscription right now." },
      { status: 502 }
    );
  }

  return NextResponse.json({ subscriptionId: subscription.id });
}
