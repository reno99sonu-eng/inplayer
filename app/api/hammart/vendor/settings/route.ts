import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getVendorProfile, setVendorWhatsappNumber } from "@/app/lib/hammartVendors";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { vendor } = await getVendorProfile(user.userId);
  if (!vendor) {
    return NextResponse.json({ error: "Vendor account not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  let whatsappNumber = body.whatsappNumber;

  if (whatsappNumber === "") whatsappNumber = null;
  else if (typeof whatsappNumber === "string") whatsappNumber = whatsappNumber.trim().slice(0, 20);

  try {
    await setVendorWhatsappNumber(user.userId, whatsappNumber || null);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to update vendor settings:", err);
    return NextResponse.json({ error: "Failed to update settings." }, { status: 500 });
  }
}
