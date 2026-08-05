import { unstable_cache } from "next/cache";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dynamodb";

// Real house-ad creatives — used when Admin Panel -> Advertising has a
// slot's source set to "house" (as opposed to "adsense" or "off", see
// app/lib/platformSettings.ts). One DynamoDB row per creative, PK adId
// (random UUID) — a placement can have multiple creatives; the public
// GET (app/api/ads/route.ts) picks one active one for that placement at
// random, so uploading several for the same slot rotates between them
// rather than requiring a "which one is live" toggle.
export const AD_CREATIVES_TABLE = "InPlayer-Ad-Creatives";

// Every ad banner on every page was previously running its own full,
// uncached table Scan on every single visitor's page load — the same
// "slowest, most expensive DynamoDB read on the hottest path" problem
// app/lib/videoStore.ts's getReadyVideos already fixed for the video
// listings. This is that same fix applied to ad creatives: one shared
// Scan, cached for 30 seconds and reused by every placement, instead of a
// fresh Scan per ad slot per visitor. Admin create/update/delete
// (app/api/admin/ads/...) call revalidateTag(AD_CREATIVES_TAG) so a newly
// published or edited creative shows up immediately rather than waiting
// out the cache window.
export const AD_CREATIVES_TAG = "ad-creatives";

async function scanAllAdCreatives(): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({ TableName: AD_CREATIVES_TABLE, ExclusiveStartKey: exclusiveStartKey })
    );
    items.push(...((result.Items || []) as Record<string, unknown>[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

export const getAllAdCreatives = unstable_cache(scanAllAdCreatives, [AD_CREATIVES_TAG], {
  revalidate: 30,
  tags: [AD_CREATIVES_TAG],
});

// Generous budget above compressImageToBanner's ~45KB default target —
// this is a hard reject ceiling, not the target size; a creative image
// this large would be unusual but shouldn't silently corrupt the item.
export const AD_IMAGE_DATA_URL_MAX_LENGTH = 150_000;

export type AdPlacement = "homepage" | "watch" | "weekly_featured";

export interface AdCreative {
  adId: string;
  placement: AdPlacement;
  imageUrl: string;
  linkUrl: string;
  title: string;
  active: boolean;
  createdAt: string;
  impressions: number;
  clicks: number;
}

// Server-side equivalent of what app/api/ads/route.ts does for a visitor's
// browser (scan the shared 30s-cached creative list, filter to this
// placement's active creatives, pick one at random) — used directly by
// Server Components (e.g. app/page.tsx for the "weekly_featured" hero slot)
// so a real creative is already in the first server-rendered HTML instead
// of a client component having to fetch it after hydration.
export async function getActiveAdCreative(placement: AdPlacement): Promise<AdCreative | null> {
  try {
    const allCreatives = await getAllAdCreatives();
    const items = allCreatives.filter(
      (item) => item.placement === placement && item.active === true
    );
    if (items.length === 0) return null;

    const pick = items[Math.floor(Math.random() * items.length)];

    // Best-effort impression counter, same as the public GET route — never
    // blocks or fails the actual render if this write hiccups.
    docClient
      .send(
        new UpdateCommand({
          TableName: AD_CREATIVES_TABLE,
          Key: { adId: pick.adId },
          UpdateExpression: "ADD impressions :one",
          ExpressionAttributeValues: { ":one": 1 },
        })
      )
      .catch((err) => console.error("adCreatives: impression counter failed:", err));

    return {
      adId: pick.adId as string,
      placement: pick.placement as AdPlacement,
      imageUrl: pick.imageUrl as string,
      linkUrl: pick.linkUrl as string,
      title: pick.title as string,
      active: pick.active as boolean,
      createdAt: pick.createdAt as string,
      impressions: (pick.impressions as number) || 0,
      clicks: (pick.clicks as number) || 0,
    };
  } catch (err) {
    console.error(`adCreatives: getActiveAdCreative(${placement}) failed:`, err);
    return null;
  }
}
