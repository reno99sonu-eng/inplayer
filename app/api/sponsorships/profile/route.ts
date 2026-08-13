import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getSponsorProfile, upsertSponsorProfile, SponsorProfileFields } from "@/app/lib/sponsorProfiles";

const PROFILE_FIELDS: (keyof SponsorProfileFields)[] = [
  "companyName",
  "contactName",
  "contactEmail",
  "contactPhone",
  "websiteUrl",
  "legalName",
  "panOrGst",
  "businessAddress",
];

// Backs the "Profile & Settings" tab inside /sponsorships — a signed-in
// sponsor's own saved company/contact/KYC details, reused to prefill the
// checkout form on every future purchase so returning sponsors don't retype
// the same 8 fields each time. GET returns `profile: null` (not a 404) for
// a user who's never saved or bought anything yet — the panel just renders
// an empty form in that case.
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const profile = await getSponsorProfile(user.userId);
  return NextResponse.json({ profile });
}

export async function PUT(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const fields: Partial<SponsorProfileFields> = {};
  for (const key of PROFILE_FIELDS) {
    if (typeof body[key] === "string") {
      fields[key] = body[key].trim().slice(0, 500);
    }
  }

  try {
    const profile = await upsertSponsorProfile(user.userId, fields);
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("sponsorships/profile: save failed:", err);
    return NextResponse.json(
      { error: "InPlayer-Sponsor-Profiles isn't available yet — the table needs to be created in AWS first." },
      { status: 503 }
    );
  }
}
