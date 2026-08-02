import { NextResponse } from "next/server";
import { getFeaturedThisWeek } from "@/app/lib/trendingStore";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { docClient } from "@/app/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { AD_CREATIVES_TABLE } from "@/app/lib/adCreatives";

export async function GET() {
  const settings = await getPlatformSettings();

  // Weekly Featured is ON by default (enabled !== false)
  if (settings.weeklyFeaturedEnabled === false) {
    return NextResponse.json({ videos: [], banners: [], enabled: false });
  }

  const defaultVideos = await getFeaturedThisWeek(6);

  // Fetch active weekly_featured ad banners uploaded by Admin
  let adSlides: Record<string, unknown>[] = [];
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: AD_CREATIVES_TABLE,
        FilterExpression: "placement = :p AND active = :act",
        ExpressionAttributeValues: { ":p": "weekly_featured", ":act": true },
      })
    ).catch(() => null);

    if (result?.Items && result.Items.length > 0) {
      adSlides = (result.Items as Record<string, unknown>[]).map((b) => ({
        videoId: (b.linkUrl as string) || (b.adId as string),
        title: (b.title as string) || "Weekly Featured Banner",
        uploaderName: "Featured Sponsor",
        uploaderUsername: "sponsor",
        uploaderAvatarUrl: null,
        thumbnailUrl: b.imageUrl as string,
        windowViews: (b.impressions as number) || 0,
        linkUrl: b.linkUrl as string,
      }));
    }
  } catch (err) {
    console.error("Failed to fetch weekly_featured ad banners:", err);
  }

  // If admin uploaded custom weekly_featured ad posters, serve them in the Weekly Featured banner!
  // Otherwise, fall back to featured weekly videos.
  const finalVideos = adSlides.length > 0 ? adSlides : defaultVideos;

  return NextResponse.json({ videos: finalVideos, banners: adSlides, enabled: true });
}
