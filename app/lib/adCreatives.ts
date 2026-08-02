export const AD_CREATIVES_TABLE = "InPlayer-Ad-Creatives";

// Generous 25MB max budget for high-res banner images, posters, and video data URLs
export const AD_IMAGE_DATA_URL_MAX_LENGTH = 25_000_000;

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
