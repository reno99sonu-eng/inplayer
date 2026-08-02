import { NextResponse } from "next/server";
import { getFeaturedThisWeek } from "@/app/lib/trendingStore";
import { getPlatformSettings } from "@/app/lib/platformSettings";

export async function GET() {
  const settings = await getPlatformSettings();

  if (settings.weeklyFeaturedEnabled === false) {
    return NextResponse.json({ videos: [], enabled: false });
  }

  const videos = await getFeaturedThisWeek(6);
  return NextResponse.json({ videos, enabled: true });
}
