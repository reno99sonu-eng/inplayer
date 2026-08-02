import { NextResponse } from "next/server";
import { getFeaturedThisWeek } from "@/app/lib/trendingStore";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { docClient } from "@/app/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { AD_CREATIVES_TABLE } from "@/app/lib/adCreatives";

export async function GET() {
  const settings = await getPlatformSettings();
  const defaultVideos = await getFeaturedThisWeek(6);

  // Scan all items from AD_CREATIVES_TABLE
  let adSlides: Record<string, unknown>[] = [];
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: AD_CREATIVES_TABLE,
      })
    ).catch(() => null);

    if (result?.Items && Array.isArray(result.Items)) {
      // Prioritize active "weekly_featured" and "homepage" placement items
      const matching = result.Items.filter(
        (b) => b && (b.placement === "weekly_featured" || b.placement === "homepage") && b.active !== false && Boolean(b.imageUrl)
      );

      // Sort so weekly_featured items come first
      matching.sort((a, b) => (a.placement === "weekly_featured" ? -1 : 1));

      if (matching.length > 0) {
        adSlides = matching.map((b) => ({
          videoId: String(b.linkUrl || b.adId || "ad"),
          title: String(b.title || "Weekly Featured Sponsor"),
          uploaderName: "Featured Sponsor",
          uploaderUsername: "sponsor",
          uploaderAvatarUrl: null,
          thumbnailUrl: String(b.imageUrl || ""),
          windowViews: Number(b.impressions || 0),
          linkUrl: String(b.linkUrl || ""),
        }));
      }
    }
  } catch (err) {
    console.error("Failed to fetch weekly_featured ad banners:", err);
  }

  // 1. If the admin has uploaded custom ad posters (adSlides exist), AUTOMATICALLY serve the admin's uploaded poster!
  if (adSlides.length > 0) {
    return NextResponse.json({ videos: adSlides, banners: adSlides, enabled: true });
  }

  // 2. If weeklyFeaturedEnabled setting is explicitly false, return default videos
  if (settings.weeklyFeaturedEnabled === false) {
    return NextResponse.json({ videos: defaultVideos, banners: [], enabled: false });
  }

  // 3. Fallback to default user videos
  return NextResponse.json({ videos: defaultVideos, banners: adSlides, enabled: true });
}
