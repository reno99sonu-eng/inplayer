import { NextRequest, NextResponse } from "next/server";
import { geocodePincode } from "@/app/lib/geocoding";

export async function GET(request: NextRequest) {
  const pincode = request.nextUrl.searchParams.get("pincode");
  if (!pincode) {
    return NextResponse.json({ error: "Pincode is required." }, { status: 400 });
  }

  try {
    const geo = await geocodePincode(pincode);
    if (!geo) {
      return NextResponse.json({ error: "Could not find coordinates for this pincode." }, { status: 404 });
    }
    return NextResponse.json(geo);
  } catch (error) {
    return NextResponse.json({ error: "Failed to geocode." }, { status: 500 });
  }
}
