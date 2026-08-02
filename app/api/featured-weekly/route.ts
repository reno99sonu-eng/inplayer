import { NextResponse } from "next/server";
import { getFeaturedThisWeek } from "@/app/lib/trendingStore";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { docClient } from "@/app/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { AD_CREATIVES_TABLE } from "@/app/lib/adCreatives";

export async function GET() {
  const settings = await getPlatformSettings();
  const defaultVideos = await getFeaturedThisWeek(6);

  // When Weekly Featured is OFF (weeklyFeaturedEnabled === false):
  // Return EXCLUSIVELY the users' Weekly Featured content/videos!
  if (!settings.weeklyFeaturedEnabled) {
    return NextResponse.json({ videos: defaultVideos, banners: [], enabled: false });
  }

  // When Weekly Featured is ON (weeklyFeaturedEnabled === true):
  // Fetch ALL active admin-uploaded custom ad posters from AD_CREATIVES_TABLE!
  let adSlides: Record<string, unknown>[] = [];
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: AD_CREATIVES_TABLE,
      })
    ).catch(() => null);

    if (result?.Items && Array.isArray(result.Items)) {
      const matching = result.Items.filter(
        (b) => b && (b.placement === "weekly_featured" || b.placement === "homepage") && b.active !== false && Boolean(b.imageUrl)
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

  // If Weekly Featured is ON, return EXCLUSIVELY the admin's uploaded custom ad posters!
  // All user contents/videos are COMPLETELY REMOVED from the hero carousel.
  if (adSlides.length > 0) {
    return NextResponse.json({ videos: adSlides, banners: adSlides, enabled: true });
  }

  // Fallback admin ad slide if ON but no poster uploaded yet:
  const fallbackAdSlide = [
    {
      videoId: "https://inplayer.in/pro",
      title: "InPlayer Weekly Featured Sponsor Banner",
      uploaderName: "Featured Sponsor",
      uploaderUsername: "sponsor",
      uploaderAvatarUrl: null,
      thumbnailUrl:
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxOTIwIiBoZWlnaHQ9IjYwMCI+PHJlY3Qgd2lkdGg9IjE5MjAiIGhlaWdodD0iNjAwIiBmaWxsPSIjNEY0NkU1Ii8+PHRleHQgeD0iOTYwIiB5PSIzMDAiIGZvbnQtc2l6ZT0iNDgiIGZpbGw9IiNGRkZGRkYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkFkbWluIFdlZWtseSBGZWF0dXJlZCBCYW5uZXIgU3BvbnNvcjwvdGV4dD48L3N2Zz4=",
      windowViews: 1000,
      linkUrl: "https://inplayer.in/pro",
    },
  ];

  return NextResponse.json({ videos: fallbackAdSlide, banners: fallbackAdSlide, enabled: true });
}
