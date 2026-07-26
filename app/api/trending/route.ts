import { NextResponse } from "next/server";
import type { TrendingItem } from "@/app/data/trending";
import { getTrendingToday } from "@/app/lib/trendingStore";

export async function GET() {
  const videos = await getTrendingToday(20);

  return NextResponse.json({
    count: videos.length,
    videos: videos.map((v): TrendingItem => ({
      videoId: v.videoId,
      title: v.title,
      uploaderName: v.uploaderName,
      uploaderAvatarUrl: v.uploaderAvatarUrl,
      windowViews: v.windowViews,
      // Keep this exact name in sync with TrendingItem and TrendingNow.
      // Returning `thumbnail` here made the client treat every result as
      // thumbnail-less and render its default-avatar fallback.
      thumbnailUrl: v.thumbnailUrl,
    })),
  });
}
