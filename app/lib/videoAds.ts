export const MIDROLL_ADS_TABLE = "InPlayer-Midroll-Ads";

// Generous 25MB max budget for high-res midroll ad images, posters, and video data URLs
export const MIDROLL_IMAGE_DATA_URL_MAX_LENGTH = 25_000_000;

export interface MidrollAdCreative {
  adId: string;
  imageUrl: string;
  linkUrl: string;
  title: string;
  active: boolean;
  createdAt: string;
  impressions: number;
  clicks: number;
  skips: number;
}

export const MIDROLL_SKIP_TIERS_SECONDS = [5, 10, 15];
