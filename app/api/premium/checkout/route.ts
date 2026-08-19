import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { createPlainOrder } from "@/app/lib/razorpay";
import { PREMIUM_PLANS, isPremiumPlanId } from "@/app/lib/premiumPlans";

// Starts a real InPlayer Premium purchase.
//
// A plain one-time Razorpay Order (no Route transfers) — the viewer pays
// InPlayer, InPlayer is the sole merchant of record, so none of the RBI
// turnover-threshold restriction that gates Hammart vendor payouts applies.
// Exactly the same shape as the ad-sponsorship checkout.
//
// THIS ROUTE NEVER GRANTS ANYTHING. It only creates the order the browser
// pays against. Premium time is added by
// app/api/webhooks/razorpay/route.ts once Razorpay's SIGNED payment.captured
// event confirms the money actually landed — because a browser can claim a
// payment succeeded, and a signed webhook can't be faked.
//
// The price comes from PREMIUM_PLANS on the server, never from the request
// body, so a tampered client can't order a year of Premium for ₹1.
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json(
      { error: "Please sign in to get InPlayer Premium." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const planId = (body as { planId?: unknown } | null)?.planId;

  if (!isPremiumPlanId(planId)) {
    return NextResponse.json({ error: "Choose a valid Premium plan." }, { status: 400 });
  }

  const plan = PREMIUM_PLANS[planId];
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
  if (!keyId) {
    console.error("premium/checkout: NEXT_PUBLIC_RAZORPAY_KEY_ID is not set.");
    return NextResponse.json(
      { error: "Payments aren't configured yet. Please try again later." },
      { status: 503 }
    );
  }

  try {
    // `receipt` is capped at 40 chars by Razorpay, and a Cognito sub is 36 —
    // so the plan is carried in notes rather than crammed into the receipt.
    const order = await createPlainOrder({
      amountInr: plan.amountInr,
      receipt: `prem_${Date.now().toString(36)}`,
      notes: {
        type: "premium",
        planId: plan.planId,
        userId: user.userId,
      },
    });

    return NextResponse.json({
      razorpayOrderId: order.id,
      razorpayKeyId: keyId,
      amountInr: plan.amountInr,
      planId: plan.planId,
      planLabel: plan.label,
      durationDays: plan.durationDays,
    });
  } catch (err) {
    console.error("premium/checkout: Razorpay order creation failed:", err);
    return NextResponse.json(
      { error: "Couldn't start payment right now. Please try again in a moment." },
      { status: 502 }
    );
  }
}
