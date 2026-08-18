import { NextRequest, NextResponse } from "next/server";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getVisibleVideos } from "@/app/lib/contentAccessServer";

// "Up Next" for the video watch page — Videos only (Shorts are excluded
// entirely; they live in their own swipeable feed) and, for signed-in
// viewers, ranked toward the categories they actually watch most (real
// signal from InPlayer-WatchHistory), not just a static "same category"
// match. Falls back to the plain same-category-then-recency ordering for
// signed-out viewers or anyone with no history yet — never errors, never
// returns something worse than the non-personalized baseline.
export async function GET(request: NextRequest) {
  const excludeVideoId = request.nextUrl.searchParams.get("excludeVideoId") || "";
  const category = request.nextUrl.searchParams.get("category") || "";

  const candidates = (await getVisibleVideos()).filter(
    (v) =>
      v.videoId !== excludeVideoId &&
      v.contentType !== "short" &&
      (!v.visibility || v.visibility === "public")
  );

  // Build a "how much does this viewer watch each category" weight map from
  // their real watch history. Absent, empty, or errored -> stays null, and
  // we fall back to the non-personalized ordering below.
  let categoryWeight: Map<string, number> | null = null;

  try {
    const user = await verifyAuth(request);

    const historyResult = await docClient.send(
      new QueryCommand({
        TableName: "InPlayer-WatchHistory",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": user.userId },
      })
    );

    const weights = new Map<string, number>();
    for (const item of historyResult.Items || []) {
      if (!item.category) continue;
      weights.set(item.category, (weights.get(item.category) || 0) + 1);
    }
    if (weights.size > 0) categoryWeight = weights;
  } catch {
    // Not signed in, or the history table isn't reachable — fine, just
    // skip personalization and use the plain ordering below.
  }

  let ranked;

  if (categoryWeight) {
    const weight = categoryWeight; // non-null for TS inside the closure below
    ranked = [...candidates].sort((a, b) => {
      const scoreOf = (v: (typeof candidates)[number]) => {
        let score = weight.get(v.category as string) || 0;
        if (v.category === category) score += 3; // still favor "more of this exact video"
        return score;
      };

      const diff = scoreOf(b) - scoreOf(a);
      if (diff !== 0) return diff;

      // Tie-break by recency (candidates already arrive newest-first from
      // getReadyVideos, but re-assert it explicitly post-sort for safety).
      return (
        new Date(b.uploadedAt as string).getTime() -
        new Date(a.uploadedAt as string).getTime()
      );
    });
  } else {
    // Non-personalized fallback — identical to the original server-rendered
    // ordering: same category first, then everything else, both
    // newest-first (candidates already arrive that way).
    const sameCategory = candidates.filter((v) => v.category === category);
    const otherCategory = candidates.filter((v) => v.category !== category);
    ranked = [...sameCategory, ...otherCategory];
  }

  const videos = ranked.slice(0, 12).map((v) => ({
    videoId: v.videoId,
    title: v.title,
    uploaderName: v.uploaderName,
    views: v.views || 0,
    uploadedAt: v.uploadedAt,
    thumbnailUrl: v.thumbnailUrl,
  }));

  return NextResponse.json({ videos, personalized: !!categoryWeight });
}
