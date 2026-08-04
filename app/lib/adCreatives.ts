import { unstable_cache } from "next/cache";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
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

export type AdPlacement = "homepage" | "watch" | "homepage_spotlight";

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
