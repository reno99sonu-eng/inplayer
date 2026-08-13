import { NextRequest, NextResponse } from "next/server";
import { expireDueSponsorships } from "@/app/lib/sponsorships";

// Daily housekeeping only — a sponsor's ad ALREADY stops showing to real
// visitors the instant its own expiresAt passes (see the isNotExpired
// check in app/lib/adCreatives.ts and the equivalent one in
// app/api/midroll-ads/route.ts), completely independent of this cron ever
// running. This route just keeps the Sponsorship ORDER's own status field
// honest for the admin/sponsor dashboards ("Live" vs "Expired"), same
// separation of concerns as app/api/creator/payout-run.
//
// Configure once in vercel.json's crons array (added alongside the
// existing payout-run entry) — Vercel sends the same CRON_SECRET header
// automatically to every cron route in the project, so no new secret is
// needed if CRON_SECRET is already set for payout-run.
async function runExpiry(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.SPONSORSHIP_CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const provided = authHeader.replace(/^Bearer\s+/i, "");

  if (!secret) {
    return NextResponse.json(
      { error: "Set CRON_SECRET in your environment variables before this route can run." },
      { status: 503 }
    );
  }
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await expireDueSponsorships();
    return NextResponse.json(result);
  } catch (err) {
    console.error("expire-sponsorships: run failed:", err);
    return NextResponse.json({ error: "InPlayer-Sponsorships isn't available yet." }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  return runExpiry(request);
}

export async function POST(request: NextRequest) {
  return runExpiry(request);
}
