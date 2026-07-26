import { unstable_cache } from "next/cache";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dynamodb";

// Cache tag for the shared ready-videos list. The Mux webhook revalidates
// this tag the moment a new video finishes processing, so fresh uploads
// appear immediately even though reads are cached.
export const READY_VIDEOS_TAG = "ready-videos";

// The single scan every listing surface shares. Paginated (a one-shot
// Scan silently stops at ~1MB, which would start hiding videos as the
// library grows) and pre-sorted newest-first, since every consumer wants
// that ordering anyway.
async function scanReadyVideos() {
  const items: Record<string, any>[] = [];
  let exclusiveStartKey: Record<string, any> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        // A Mux asset is only safe to surface on listings after its
        // video.asset.ready webhook has stored a non-empty playback ID.
        // This is the ID image.mux.com and stream.mux.com require.
        FilterExpression:
          "#status = :ready AND attribute_exists(muxPlaybackId) AND muxPlaybackId <> :emptyPlaybackId",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":ready": "ready",
          ":emptyPlaybackId": "",
        },
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    items.push(...(result.Items || []));
    exclusiveStartKey = result.LastEvaluatedKey as
      | Record<string, any>
      | undefined;
  } while (exclusiveStartKey);

  items.sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  return items;
}

// Why this matters: previously the homepage, /videos, /shorts, AND every
// watch page's related list each ran their own full table Scan on every
// single request — the slowest, most expensive way to read DynamoDB, on
// the hottest paths in the app. This caches ONE shared result for 30
// seconds across all of them, so most page loads skip the database round
// trip entirely. View counts shown on cards can lag by up to 30s; new
// uploads don't lag at all thanks to the webhook's revalidateTag.
export const getReadyVideos = unstable_cache(
  scanReadyVideos,
  [READY_VIDEOS_TAG],
  {
    revalidate: 30,
    tags: [READY_VIDEOS_TAG],
  }
);
