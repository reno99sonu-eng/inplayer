import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { createVendorProfile, getVendorProfile, type BusinessType } from "@/app/lib/hammartVendors";

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

  if (!vendorId) {
    return NextResponse.json({ error: "Vendor ID is required." }, { status: 400 });
  }
  if (businessType === "business" && !businessName) {
    return NextResponse.json({ error: "Business name is required for a registered business." }, { status: 400 });
  }

  const { vendor: existing } = await getVendorProfile(user.userId);
  if (existing) {
    return NextResponse.json({ success: true, vendorId: existing.vendorId, alreadyExists: true });
  }

  const result = await createVendorProfile({
    userId: user.userId,
    vendorId,
    businessType,
    businessName,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.reason || "Couldn't create your vendor account.", tableMissing: result.tableMissing },
      { status: result.tableMissing ? 503 : 409 }
    );
  }

  return NextResponse.json({ success: true, vendorId });
}
