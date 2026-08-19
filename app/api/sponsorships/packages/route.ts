import { NextRequest, NextResponse } from "next/server";
import { SPONSORSHIP_PACKAGES, SPONSORSHIP_DURATION_DAYS } from "@/app/lib/sponsorships";
import { verifyAuth } from "@/app/lib/verifyAuth";

// Powers the sponsorship page (app/sponsorships/page.tsx).
//
// Answers signed-out too, because the whole point of the page is that a
// visitor can read what sponsoring gets them before creating an account —
// but WHAT it answers depends on who is asking:
//
//   signed out  ->  label, sections, description, benefits.  No amountInr.
//   signed in   ->  the same, plus amountInr, for the checkout screen.
//
// So the rate card isn't sitting in a public JSON endpoint for anyone
// (competitors included) to read, and the price a sponsor sees is the one
// on the order they're about to place. Same reasoning already applied to
// SPONSORSHIP_ASSET_SPECS: those only come back from
// GET /api/sponsorships/[sponsorshipId] once that order is actually paid.
export async function GET(request: NextRequest) {
  let signedIn = false;
  try {
    await verifyAuth(request);
    signedIn = true;
  } catch {
    // Anonymous visitor - benefits only.
  }

  const packages = Object.values(SPONSORSHIP_PACKAGES).map((pkg) =>
    signedIn ? pkg : { ...pkg, amountInr: undefined }
  );

  return NextResponse.json({
    packages,
    durationDays: SPONSORSHIP_DURATION_DAYS,
  });
}
