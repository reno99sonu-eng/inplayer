import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getVendorProfile } from "@/app/lib/hammartVendors";

// "Am I a vendor, and what's my status?" — the vendor dashboard and any
// other Hammart UI checks this first to decide what to show (nothing yet
// signed up, still needs KYC, fully verified, etc).
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { vendor, tableMissing } = await getVendorProfile(user.userId);
  return NextResponse.json({ vendor, tableMissing });
}
