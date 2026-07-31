import { NextRequest, NextResponse } from "next/server";
import { checkVendorIdAvailable } from "@/app/lib/hammartVendors";

// Deliberately PUBLIC (no verifyAuth) — this runs live on the signup form,
// before an account exists, so there's no token to check yet. It only
// ever answers "is this vendor ID free," which is safe to expose the same
// way any storefront-slug checker is.
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("vendorId") || "";
  const result = await checkVendorIdAvailable(raw);
  return NextResponse.json(result);
}
