import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { listAllSponsorshipsForAdmin } from "@/app/lib/sponsorships";
import { getAllAdCreatives } from "@/app/lib/adCreatives";
import { getAllMidrollAds } from "@/app/lib/videoAds";

// Every sponsorship order ever placed, plus how many creative assets are
// currently staged for each one (across both ad-rendering tables) — lets
// Admin -> Sponsorships show "2 assets ready" at a glance without opening
// every order, same spirit as the Hammart Orders admin list.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [sponsorships, bannerCreatives, midrollAds] = await Promise.all([
      listAllSponsorshipsForAdmin(),
      getAllAdCreatives().catch(() => []),
      getAllMidrollAds().catch(() => []),
    ]);

    const assetCounts: Record<string, number> = {};
    for (const c of bannerCreatives) {
      const sid = c.sponsorshipId as string | undefined;
      if (sid) assetCounts[sid] = (assetCounts[sid] || 0) + 1;
    }
    for (const a of midrollAds) {
      const sid = a.sponsorshipId as string | undefined;
      if (sid) assetCounts[sid] = (assetCounts[sid] || 0) + 1;
    }

    const items = sponsorships.map((s) => ({ ...s, assetCount: assetCounts[s.sponsorshipId] || 0 }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("admin/sponsorships: list failed (table may not exist yet):", err);
    return NextResponse.json({ items: [], tableMissing: true });
  }
}
