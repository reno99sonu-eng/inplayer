import { NextResponse } from "next/server";
import { SPONSORSHIP_PACKAGES, SPONSORSHIP_DURATION_DAYS } from "@/app/lib/sponsorships";

// Public, unauthenticated — powers the pricing section of the sponsorship
// landing page (app/sponsorships/page.tsx). Deliberately does NOT include
// SPONSORSHIP_ASSET_SPECS (poster ratios/specs) — those only come back
// from GET /api/sponsorships/[sponsorshipId] once that order's
// paymentStatus is "paid", matching "poster specs and ratios only shows up
// to the sponsor when they purchase".
export async function GET() {
  return NextResponse.json({
    packages: Object.values(SPONSORSHIP_PACKAGES),
    durationDays: SPONSORSHIP_DURATION_DAYS,
  });
}
