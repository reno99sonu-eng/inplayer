import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { createPlainOrder } from "@/app/lib/razorpay";
import {
  SPONSORSHIP_PACKAGES,
  SponsorshipPackageType,
  createSponsorshipOrder,
  attachRazorpayOrder,
} from "@/app/lib/sponsorships";
import { upsertSponsorProfile } from "@/app/lib/sponsorProfiles";

// Starts a real sponsor purchase: creates the order row (status
// "pending_payment"), then a real one-time Razorpay Order for the exact
// package price with NO transfers — the money lands straight in
// InPlayer's own account, same as a membership charge (see
// createPlainOrder's header comment in app/lib/razorpay.ts for why this
// never needs Route). The browser opens Razorpay Checkout against the
// returned order id; the order only actually becomes "paid" once
// app/api/webhooks/razorpay/route.ts's payment.captured handler confirms
// it — this route's job is only ever to start that process, never to mark
// anything paid itself.
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in to sponsor an ad." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const {
    packageType,
    companyName,
    contactName,
    contactEmail,
    contactPhone,
    websiteUrl,
    legalName,
    panOrGst,
    businessAddress,
  } = body;

  if (!packageType || !(packageType in SPONSORSHIP_PACKAGES)) {
    return NextResponse.json({ error: "Choose a valid sponsorship package." }, { status: 400 });
  }
  const requiredStrings: Record<string, unknown> = {
    companyName,
    contactName,
    contactEmail,
    contactPhone,
    websiteUrl,
    legalName,
    panOrGst,
    businessAddress,
  };
  for (const [field, value] of Object.entries(requiredStrings)) {
    if (typeof value !== "string" || !value.trim()) {
      return NextResponse.json({ error: `${field} is required.` }, { status: 400 });
    }
  }
  if (!/^https?:\/\//i.test(websiteUrl.trim())) {
    return NextResponse.json(
      { error: "Website URL must start with http:// or https://." },
      { status: 400 }
    );
  }
  if (!/^\S+@\S+\.\S+$/.test(contactEmail.trim())) {
    return NextResponse.json({ error: "Enter a valid contact email." }, { status: 400 });
  }

  let sponsorship;
  try {
    sponsorship = await createSponsorshipOrder({
      userId: user.userId,
      companyName,
      contactName,
      contactEmail,
      contactPhone,
      websiteUrl,
      packageType: packageType as SponsorshipPackageType,
      legalName,
      panOrGst,
      businessAddress,
    });
  } catch (err) {
    console.error("sponsorships/checkout: couldn't create order:", err);
    return NextResponse.json(
      { error: "InPlayer-Sponsorships isn't available yet — the table needs to be created in AWS first." },
      { status: 503 }
    );
  }

  // Save/update this sponsor's reusable profile with whatever they just
  // typed, so their NEXT purchase's checkout form (and the Profile &
  // Settings tab) starts prefilled — never blocks or fails the actual
  // order/payment if this write hiccups.
  upsertSponsorProfile(user.userId, {
    companyName,
    contactName,
    contactEmail,
    contactPhone,
    websiteUrl,
    legalName,
    panOrGst,
    businessAddress,
  }).catch((err) => console.error("sponsorships/checkout: profile save failed (non-fatal):", err));

  try {
    const razorpayOrder = await createPlainOrder({
      amountInr: sponsorship.amountInr,
      receipt: sponsorship.sponsorshipId,
      notes: { type: "sponsorship", sponsorshipId: sponsorship.sponsorshipId },
    });
    await attachRazorpayOrder(sponsorship.sponsorshipId, razorpayOrder.id);

    return NextResponse.json({
      sponsorshipId: sponsorship.sponsorshipId,
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
      amountInr: sponsorship.amountInr,
    });
  } catch (err) {
    console.error("sponsorships/checkout: Razorpay order creation failed:", err);
    return NextResponse.json(
      { error: "Couldn't start payment right now. Please try again in a moment." },
      { status: 502 }
    );
  }
}
