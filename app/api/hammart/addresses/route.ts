import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { createAddress, listUserAddresses } from "@/app/lib/hammartAddressBook";
import { geocodePincode } from "@/app/lib/geocoding";

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { addresses, tableMissing } = await listUserAddresses(user.userId);
  return NextResponse.json({ addresses, tableMissing });
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { label, name, phone, deliveryAddress, city, state, pincode } = body;

  if (!name || !phone || !deliveryAddress || !city || !state || !pincode) {
    return NextResponse.json({ error: "All address fields are required." }, { status: 400 });
  }

  // Geocode the pincode to store lat/lng
  let lat: number | undefined;
  let lng: number | undefined;
  try {
    const geo = await geocodePincode(pincode);
    if (geo) {
      lat = geo.latitude;
      lng = geo.longitude;
    }
  } catch (err) {
    console.error("Geocoding failed for new address", err);
  }

  const result = await createAddress({
    userId: user.userId,
    label: label || "Other",
    name: name.slice(0, 100),
    phone: phone.slice(0, 20),
    deliveryAddress: deliveryAddress.slice(0, 500),
    city: city.slice(0, 100),
    state: state.slice(0, 100),
    pincode: pincode.slice(0, 10),
    lat,
    lng,
  });

  if (!result.success) {
    return NextResponse.json({ error: "Failed to save address." }, { status: 500 });
  }

  return NextResponse.json(result.address);
}
