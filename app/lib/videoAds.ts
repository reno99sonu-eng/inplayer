// Real mid-roll video ad creatives — a separate table/model from
// app/lib/adCreatives.ts's static banner creatives on purpose: mid-roll
// ads are shown full-screen over a paused player mid-playback (see
// app/components/VideoPlayer.tsx), tracked with their own skip metric,
// and have no "placement" concept (there's only ever one mid-roll slot:
// inside the player itself). Same overall shape/conventions as
// adCreatives.ts otherwise — PK adId, Scan+random-pick to serve, fire-
// and-forget impression/click counters.
export const MIDROLL_ADS_TABLE = "InPlayer-Midroll-Ads";

// Same budget as AD_IMAGE_DATA_URL_MAX_LENGTH in adCreatives.ts.
export const MIDROLL_IMAGE_DATA_URL_MAX_LENGTH = 150_000;

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

// The actual "tiered skip timers" — how many seconds of the ad break a
// viewer must wait out before the Skip button unlocks. Index 0 applies to
// the first mid-roll break shown during a single playback session, index
// 1 the second, and every break after that uses the last (longest) tier.
// Deliberately NOT a per-ad admin setting: this is a platform-wide
// escalation rule (the same one for every ad), which is what "tiered
// skip timers" means here — the tier is a function of how many breaks
// THIS viewer has already sat through in THIS video, not a property of
// the creative itself. See app/components/VideoPlayer.tsx for where this
// is actually consumed.
export const MIDROLL_SKIP_TIERS_SECONDS = [5, 10, 15];
