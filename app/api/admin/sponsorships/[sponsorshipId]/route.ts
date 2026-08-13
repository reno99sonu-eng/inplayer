import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { getSponsorship } from "@/app/lib/sponsorships";
import { getAllAdCreatives } from "@/app/lib/adCreatives";
import { getAllMidrollAds } from "@/app/lib/videoAds";

// Full admin detail view for one sponsorship order — the order itself plus
// every creative currently staged/live under it (across both ad-rendering
// tables), so an admin can review exactly what's been uploaded before
// hitting Activate. Powers app/admin/sponsorships/[sponsorshipId]/page.tsx.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sponsorshipId: string }> }
) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sponsorshipId } = await params;
  const sponsorship = await getSponsorship(sponsorshipId).catch(() => null);
  if (!sponsorship) {
    return NextResponse.json({ error: "Sponsorship not found." }, { status: 404 });
  }

  const [bannerCreatives, midrollAds] = await Promise.all([
    getAllAdCreatives().catch(() => []),
    getAllMidrollAds().catch(() => []),
  ]);

  const creatives = [
    ...bannerCreatives.filter((c) => c.sponsorshipId === sponsorshipId),
    ...midrollAds.filter((a) => a.sponsorshipId === sponsorshipId),
  ];

  return NextResponse.json({ sponsorship, creatives });
}
