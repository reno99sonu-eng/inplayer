import { NextResponse } from "next/server";
import { getFeaturedThisWeek } from "@/app/lib/trendingStore";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { docClient } from "@/app/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { AD_CREATIVES_TABLE } from "@/app/lib/adCreatives";

export async function GET() {
  const settings = await getPlatformSettings();
  const defaultVideos = await getFeaturedThisWeek(6);

  // Scan all items from AD_CREATIVES_TABLE (without filter expressions that might fail on attribute type mismatches)
  let adSlides: Record<string, unknown>[] = [];
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: AD_CREATIVES_TABLE,
      })
    ).catch(() => null);

    if (result?.Items && Array.isArray(result.Items)) {
      const matching = result.Items.filter(
        (b) => b && b.placement === "weekly_featured" && b.active !== false && Boolean(b.imageUrl)
      );

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

  // When Weekly Featured is ON (weeklyFeaturedEnabled === true) OR if custom admin posters exist:
  // Return the admin's uploaded custom ad posters!
  if (settings.weeklyFeaturedEnabled && adSlides.length > 0) {
    return NextResponse.json({ videos: adSlides, banners: adSlides, enabled: true });
  }

  // If Weekly Featured is OFF (or no admin poster uploaded), return users' Weekly Featured content!
  return NextResponse.json({ videos: defaultVideos, banners: adSlides, enabled: false });
}
