import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { listVendorProducts } from "@/app/lib/hammartProducts";

// A vendor's own listing management view — includes hidden/flagged
// listings the public storefront never shows.
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  const { products, tableMissing } = await listVendorProducts(user.userId);
  return NextResponse.json({ products, tableMissing });
}
