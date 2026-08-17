import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getVendorProfile, updateVendorSettings } from "@/app/lib/hammartVendors";
import { geocodePincode } from "@/app/lib/geocoding";

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

  const address = typeof body.address === "string" ? body.address.trim() : "";
  const pincode = typeof body.pincode === "string" ? body.pincode.trim() : "";

  let latitude: number | undefined = undefined;
  let longitude: number | undefined = undefined;

  if (pincode) {
    const geo = await geocodePincode(pincode);
    if (geo) {
      latitude = geo.latitude;
      longitude = geo.longitude;
    } else {
      // If they provide a pincode but we can't find it, we shouldn't necessarily block them, 
      // but ideally we'd want valid coordinates. For MVP, we'll just leave it undefined if not found.
    }
  }

  try {
    await updateVendorSettings(user.userId, { 
      whatsappNumber: whatsappNumber || null,
      address,
      pincode,
      latitude,
      longitude
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to update vendor settings:", err);
    return NextResponse.json({ error: "Failed to update settings." }, { status: 500 });
  }
}
