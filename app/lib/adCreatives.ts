// Real house-ad creatives — used when Admin Panel -> Advertising has a
// slot's source set to "house" (as opposed to "adsense" or "off", see
// app/lib/platformSettings.ts). One DynamoDB row per creative, PK adId
// (random UUID) — a placement can have multiple creatives; the public
// GET (app/api/ads/route.ts) picks one active one for that placement at
// random, so uploading several for the same slot rotates between them
// rather than requiring a "which one is live" toggle.
export const AD_CREATIVES_TABLE = "InPlayer-Ad-Creatives";

// Generous budget above compressImageToBanner's ~45KB default target —
// this is a hard reject ceiling, not the target size; a creative image
// this large would be unusual but shouldn't silently corrupt the item.
export const AD_IMAGE_DATA_URL_MAX_LENGTH = 150_000;

export type AdPlacement = "homepage" | "watch";

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
