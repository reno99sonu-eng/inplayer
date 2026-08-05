import { NextResponse } from "next/server";
import type { TrendingCreator } from "@/app/data/trending";
import { getTrendingCreators } from "@/app/lib/trendingStore";

// See app/api/platform-settings/route.ts's comment on force-dynamic — this
// route has the same shape (no request-based signal) and the same problem:
// today's ranking needs to be computed fresh on every request, not served
// from a stale snapshot.
export const dynamic = "force-dynamic";

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
