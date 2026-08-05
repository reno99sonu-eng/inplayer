import { NextResponse } from "next/server";
import type { TrendingCreator } from "@/app/data/trending";
import { getTrendingCreators } from "@/app/lib/trendingStore";

export async function GET() {
  const creators = await getTrendingCreators(20);

  return NextResponse.json({
    count: creators.length,
    creators: creators.map((creator): TrendingCreator => ({
      userId: creator.userId,
      username: creator.username,
      name: creator.name,
      avatarUrl: creator.avatarUrl,
      isVerified: creator.isVerified,
      windowViews: creator.windowViews,
    })),
  });
}
