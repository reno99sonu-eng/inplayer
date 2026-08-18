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

  let geocodeFailed = false;

  if (pincode) {
    const geo = await geocodePincode(pincode);
    if (geo) {
      latitude = geo.latitude;
      longitude = geo.longitude;
    } else {
      // Deliberately still saves the rest of their settings rather than
      // blocking the whole save on a third-party lookup. But it must not
      // pass silently: with no coordinates this vendor is excluded from the
      // storefront's 15km filter entirely, and until now the only symptom
      // was an empty shop with no explanation to anybody.
      //
      // Two things cover it now — `geocodeFailed` comes back so the vendor
      // UI can say so plainly, and the storefront retries the lookup on read
      // via ensureVendorCoordinates(), so a transient Nominatim failure
      // repairs itself instead of permanently hiding a real seller.
      geocodeFailed = true;
      console.warn(
        `vendor/settings: could not geocode pincode "${pincode}" for ${user.userId} — saved without coordinates; will retry on read.`
      );
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
    return NextResponse.json({
      success: true,
      geocodeFailed,
      // True when this vendor cannot appear in any customer's storefront at
      // all, because there is no pincode to place them by.
      needsLocation: !pincode,
    });
  } catch (err) {
    console.error("Failed to update vendor settings:", err);
    return NextResponse.json({ error: "Failed to update settings." }, { status: 500 });
  }
}
