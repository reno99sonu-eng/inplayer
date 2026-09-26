import { unstable_cache } from "next/cache";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dynamodb";

// Cache tag for the shared ready-videos list. The Mux webhook revalidates
// this tag the moment a new video finishes processing, so fresh uploads
// appear immediately even though reads are cached.
export const READY_VIDEOS_TAG = "ready-videos";

// A DynamoDB scan page is capped at 1MB. Cache pages separately so the full
// shared result cannot exceed Next's per-entry data-cache size limit as the
// library grows. A single cached array can grow past 2MB and silently miss
// every cache write, making every listing repeat the full table scan.
const getCachedReadyVideoPage = unstable_cache(
  async (exclusiveStartKey: Record<string, unknown> | null) => {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        // A Mux asset is only safe to surface on listings after its
        // video.asset.ready webhook has stored a non-empty playback ID.
        // This is the ID image.mux.com and stream.mux.com require.
        // moderationHidden (see app/api/upload/create and
        // app/lib/moderation.ts) keeps anything auto-flagged at upload out
        // of every surface that reads from this shared cache — homepage,
        // /videos, /shorts, and every watch page's related list.
        FilterExpression:
          "#status = :ready AND attribute_exists(muxPlaybackId) AND muxPlaybackId <> :emptyPlaybackId " +
          "AND (attribute_not_exists(moderationHidden) OR moderationHidden = :notHidden)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":ready": "ready",
          ":emptyPlaybackId": "",
          ":notHidden": false,
        },
        ExclusiveStartKey: exclusiveStartKey ?? undefined,
      })
    );

    // captionsVtt (see app/api/webhooks/mux/route.ts) stores the FULL raw
    // subtitle text for every generated language directly on the video
    // item — no listing surface reads it (captions are fetched separately,
    // per-video, by app/api/videos/[videoId]/captions/[lang]/route.ts when
    // someone actually turns them on). Left in, it was blowing this shared
    // cached list past Next.js's 2MB per-entry cache-write limit (seen in
    // production logs as "Failed to set Next.js data cache ... items over
    // 2MB can not be cached", ~8.5MB), which silently defeated the whole
    // point of this cache — every homepage/videos/shorts/trending load was
    // paying for a full, uncached table Scan every single time instead of
    // the intended 30-second-shared read. Stripped here, before anything
    // is cached or returned, since nothing downstream needs it.
    const items = (result.Items || []) as Record<string, unknown>[];
    for (const item of items) {
      if ("captionsVtt" in item) delete item.captionsVtt;
    }

    return {
      items,
      nextKey:
        (result.LastEvaluatedKey as Record<string, unknown> | undefined) ??
        null,
    };
  },
  [READY_VIDEOS_TAG, "page"],
  {
    revalidate: 30,
    tags: [READY_VIDEOS_TAG],
  }
);

// Read each cached page and pre-sort newest-first, since every consumer
// wants that ordering anyway.
async function scanReadyVideos() {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | null = null;

  do {
    const page = await getCachedReadyVideoPage(exclusiveStartKey);
    items.push(...page.items);
    exclusiveStartKey = page.nextKey;
  } while (exclusiveStartKey);

  items.sort(
    (a, b) =>
      new Date(b.uploadedAt as string).getTime() -
      new Date(a.uploadedAt as string).getTime()
  );

  return items;
}

// Why this matters: previously the homepage, /videos, /shorts, AND every
// watch page's related list each ran their own full table Scan on every
// single request — the slowest, most expensive way to read DynamoDB, on
// the hottest paths in the app. This caches each scan page for 30 seconds
// across all of them, so most page loads skip the database round
// trip entirely. View counts shown on cards can lag by up to 30s; new
// uploads don't lag at all thanks to the webhook's revalidateTag.
export const getReadyVideos = scanReadyVideos;
