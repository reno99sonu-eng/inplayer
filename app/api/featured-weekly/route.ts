import { NextResponse } from "next/server";
import { getFeaturedThisWeek } from "@/app/lib/trendingStore";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { docClient } from "@/app/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { AD_CREATIVES_TABLE } from "@/app/lib/adCreatives";

export async function GET() {
  const settings = await getPlatformSettings();
  const defaultVideos = await getFeaturedThisWeek(6);

  // When Weekly Featured is OFF (default state):
  // Show users' Weekly Featured content/videos!
  if (!settings.weeklyFeaturedEnabled) {
    return NextResponse.json({ videos: defaultVideos, banners: [], enabled: false });
  }

  // When Weekly Featured is ON (Admin Custom Poster mode):
  // Swap the poster inside the Weekly Featured banner to the admin's uploaded ad posters!
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

  // If admin has uploaded custom weekly_featured ad posters, display them.
  // Otherwise, fall back to featured weekly user videos so the section never disappears!
  const finalVideos = adSlides.length > 0 ? adSlides : defaultVideos;

  return NextResponse.json({ videos: finalVideos, banners: adSlides, enabled: true });
}
