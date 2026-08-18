import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { createVendorProfile, getVendorProfile, type BusinessType } from "@/app/lib/hammartVendors";
import { geocodePincode } from "@/app/lib/geocoding";

// Called once, right after a brand-new account finishes the normal sign-up
// flow (accepts terms) — see the "pending vendor" localStorage handoff in
// SignUpModal.tsx / AuthProvider.tsx's handleAcceptTerms(), the same
// pattern already used to carry the pending age across email verification.
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const vendorId = typeof body.vendorId === "string" ? body.vendorId.trim() : "";
  const businessType: BusinessType = body.businessType === "business" ? "business" : "individual";
  const businessName =
    businessType === "business" && typeof body.businessName === "string"
      ? body.businessName.trim().slice(0, 200)
      : null;

  // Delivery pincode is REQUIRED at registration. Previously this route
  // collected none, which meant every vendor was created with no pincode and
  // therefore no coordinates — and the storefront's 15km filter skips any
  // vendor without coordinates. The result was that a seller could register,
  // get verified, publish listings, and still be invisible to every single
  // customer, with no error surfaced to them, the admin, or the buyer. That
  // was the real cause of "Coming soon to your neighbourhood" showing while
  // real vendors and products existed.
  const pincode = typeof body.pincode === "string" ? body.pincode.trim() : "";

  if (!vendorId) {
    return NextResponse.json({ error: "Vendor ID is required." }, { status: 400 });
  }
  // Indian PIN codes are exactly 6 digits and never start with 0.
  if (!/^[1-9][0-9]{5}$/.test(pincode)) {
    return NextResponse.json(
      { error: "Please enter a valid 6-digit delivery pincode." },
      { status: 400 }
    );
  }
  if (businessType === "business" && !businessName) {
    return NextResponse.json({ error: "Business name is required for a registered business." }, { status: 400 });
  }

  const { vendor: existing } = await getVendorProfile(user.userId);
  if (existing) {
    return NextResponse.json({ success: true, vendorId: existing.vendorId, alreadyExists: true });
  }

  // Resolve coordinates now so the vendor is visible from the moment they
  // are approved. A failure here does NOT block registration — sign-up must
  // never depend on a third-party geocoder being up — because
  // ensureVendorCoordinates() retries on the next storefront read.
  const geo = await geocodePincode(pincode);
  if (!geo) {
    console.warn(
      `vendor/register: could not geocode "${pincode}" for ${user.userId} — registering without coordinates; will retry on read.`
    );
  }

  const result = await createVendorProfile({
    userId: user.userId,
    vendorId,
    businessType,
    businessName,
    pincode,
    latitude: geo?.latitude,
    longitude: geo?.longitude,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.reason || "Couldn't create your vendor account.", tableMissing: result.tableMissing },
      { status: result.tableMissing ? 503 : 409 }
    );
  }

  return NextResponse.json({ success: true, vendorId, geocodeFailed: !geo });
}
