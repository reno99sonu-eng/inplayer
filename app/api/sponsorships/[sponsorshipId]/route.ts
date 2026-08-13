import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { isAdminEmail } from "@/app/lib/isAdmin";
import { getSponsorship, SPONSORSHIP_ASSET_SPECS } from "@/app/lib/sponsorships";
import { getAllAdCreatives } from "@/app/lib/adCreatives";
import { getAllMidrollAds } from "@/app/lib/videoAds";

// One sponsor's own campaign detail — powers app/sponsorships/checkout's
// post-payment confirmation screen (specs + "email your assets" step) and
// app/sponsorships/dashboard's per-campaign analytics view. Gated to the
// sponsorship's own owner (or an admin) — nobody else's KYC/contact
// details or campaign performance are visible here.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sponsorshipId: string }> }
) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { sponsorshipId } = await params;
  const sponsorship = await getSponsorship(sponsorshipId).catch(() => null);
  if (!sponsorship) {
    return NextResponse.json({ error: "Sponsorship not found." }, { status: 404 });
  }
  if (sponsorship.userId !== user.userId && !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  // Poster specs/ratios only ever go out once payment is confirmed —
  // matches "poster specs and ratios only shows up to the sponsor when
  // they purchase" exactly. Before that, only the order itself comes back.
  const specs =
    sponsorship.paymentStatus === "paid"
      ? Object.fromEntries(sponsorship.sections.map((s) => [s, SPONSORSHIP_ASSET_SPECS[s]]))
      : undefined;

  // Real analytics, pulled straight from whichever ad-rendering rows are
  // tagged with this sponsorshipId (see app/lib/adCreatives.ts /
  // app/lib/videoAds.ts) — the exact same impressions/clicks counters
  // every house ad already uses, just filtered down to this sponsor's own
  // creatives. Empty/zero until an admin has actually activated the
  // campaign (see app/api/admin/sponsorships/[sponsorshipId]/activate).
  let analytics: { section: string; impressions: number; clicks: number; skips?: number }[] = [];
  try {
    const [bannerCreatives, midrollAds] = await Promise.all([
      getAllAdCreatives(),
      getAllMidrollAds(),
    ]);
    const banners = bannerCreatives
      .filter((c) => c.sponsorshipId === sponsorshipId)
      .map((c) => ({
        section: c.placement === "homepage" ? "homepage_banner" : "watch_banner",
        impressions: (c.impressions as number) || 0,
        clicks: (c.clicks as number) || 0,
      }));
    const midroll = midrollAds
      .filter((a) => a.sponsorshipId === sponsorshipId)
      .map((a) => ({
        section: "midroll",
        impressions: (a.impressions as number) || 0,
        clicks: (a.clicks as number) || 0,
        skips: (a.skips as number) || 0,
      }));
    analytics = [...banners, ...midroll];
  } catch (err) {
    console.error(`sponsorships/${sponsorshipId}: analytics lookup failed:`, err);
  }

  return NextResponse.json({ sponsorship, specs, analytics });
}
