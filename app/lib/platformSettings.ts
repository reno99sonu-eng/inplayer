import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { revalidateTag, unstable_cache } from "next/cache";
import { docClient } from "@/app/lib/dynamodb";

export const PLATFORM_SETTINGS_TABLE = "InPlayer-Platform-Settings";
export const PLATFORM_SETTINGS_TAG = "platform-settings";

export type AdSlotSource = "house" | "adsense" | "off";

// Maintenance mode and the announcement banner used to be ONE flat toggle
// each, gating InPlayer, Hammart, and Sponsorship all at once — so turning
// on maintenance mode from the Hammart admin panel took down InPlayer and
// Sponsorship too, which is exactly the bug Reno reported and asked to be
// fixed ("each and every configuration and settings should work
// individually for the individual panel"). Both are now three independent
// fields (one set per domain, see app/lib/siteDomain.ts for the shared
// domain-picking helpers) so flipping one panel's switch never touches the
// other two. Same idea for AI moderation: InPlayer's three content-type
// toggles were already correctly InPlayer-only; hammartModerationEnabledListings
// is the new equivalent on/off switch for Hammart's separate banned-item
// listing check (app/lib/hammartModeration.ts), which previously had no
// toggle at all and always ran unconditionally.
export interface PlatformSettings {
  inplayerMaintenanceMode: boolean;
  inplayerMaintenanceMessage: string;
  hammartMaintenanceMode: boolean;
  hammartMaintenanceMessage: string;
  sponsorshipMaintenanceMode: boolean;
  sponsorshipMaintenanceMessage: string;

  // Not domain-split: there's one shared InPlayer sign-in used to access
  // InPlayer, Hammart, and Sponsorship alike, so "pause new account
  // creation" is genuinely a single platform-wide switch, not something
  // that makes sense to fork into three copies.
  signupsEnabled: boolean;

  inplayerAnnouncementEnabled: boolean;
  inplayerAnnouncementText: string;
  // Destination for the announcement overlay's CTA button — optional. When
  // empty, the overlay still shows (headline + close button), it just
  // doesn't render a button pointing nowhere real.
  inplayerAnnouncementLinkUrl: string;
  hammartAnnouncementEnabled: boolean;
  hammartAnnouncementText: string;
  hammartAnnouncementLinkUrl: string;
  sponsorshipAnnouncementEnabled: boolean;
  sponsorshipAnnouncementText: string;
  sponsorshipAnnouncementLinkUrl: string;

  moderationEnabledComments: boolean;
  moderationEnabledMessages: boolean;
  moderationEnabledUploads: boolean;
  hammartModerationEnabledListings: boolean;

  adsenseEnabled: boolean;
  adsensePublisherId: string;
  homepageBannerSource: AdSlotSource;
  watchPageBannerSource: AdSlotSource;
  weeklyFeaturedEnabled: boolean;
  midrollEnabled: boolean;
  midrollIntervalSeconds: number;
  
  // Monetization Configuration
  monetizationEnabled: boolean;
  monetizationRequiredSubscribers: number;
  monetizationRequiredVideoViews: number;
  monetizationRequiredShortViews: number;
  monetizationRequireBoth: boolean;
  monetizationRequireGoodStanding: boolean;
  monetizationCreatorShare: number;
  monetizationPlatformShare: number;

  updatedAt: string | null;
  updatedBy: string | null;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  inplayerMaintenanceMode: false,
  inplayerMaintenanceMessage: "InPlayer is down for scheduled maintenance. We'll be back shortly.",
  hammartMaintenanceMode: false,
  hammartMaintenanceMessage: "Hammart is down for scheduled maintenance. We'll be back shortly.",
  sponsorshipMaintenanceMode: false,
  sponsorshipMaintenanceMessage: "Sponsorships is down for scheduled maintenance. We'll be back shortly.",
  signupsEnabled: true,
  inplayerAnnouncementEnabled: false,
  inplayerAnnouncementText: "",
  inplayerAnnouncementLinkUrl: "",
  hammartAnnouncementEnabled: false,
  hammartAnnouncementText: "",
  hammartAnnouncementLinkUrl: "",
  sponsorshipAnnouncementEnabled: false,
  sponsorshipAnnouncementText: "",
  sponsorshipAnnouncementLinkUrl: "",
  moderationEnabledComments: true,
  moderationEnabledMessages: true,
  moderationEnabledUploads: true,
  hammartModerationEnabledListings: true,
  adsenseEnabled: false,
  adsensePublisherId: "",
  homepageBannerSource: "house",
  watchPageBannerSource: "house",
  weeklyFeaturedEnabled: true, // ON by default
  midrollEnabled: true,
  midrollIntervalSeconds: 900,
  monetizationEnabled: false,
  monetizationRequiredSubscribers: 500,
  monetizationRequiredVideoViews: 50000,
  monetizationRequiredShortViews: 1000000,
  monetizationRequireBoth: true,
  monetizationRequireGoodStanding: true,
  monetizationCreatorShare: 0.8,
  monetizationPlatformShare: 0.2,
  updatedAt: null,
  updatedBy: null,
};

export type PublicPlatformSettings = Pick<
  PlatformSettings,
  | "inplayerMaintenanceMode"
  | "inplayerMaintenanceMessage"
  | "hammartMaintenanceMode"
  | "hammartMaintenanceMessage"
  | "sponsorshipMaintenanceMode"
  | "sponsorshipMaintenanceMessage"
  | "signupsEnabled"
  | "inplayerAnnouncementEnabled"
  | "inplayerAnnouncementText"
  | "inplayerAnnouncementLinkUrl"
  | "hammartAnnouncementEnabled"
  | "hammartAnnouncementText"
  | "hammartAnnouncementLinkUrl"
  | "sponsorshipAnnouncementEnabled"
  | "sponsorshipAnnouncementText"
  | "sponsorshipAnnouncementLinkUrl"
  | "adsenseEnabled"
  | "adsensePublisherId"
  | "homepageBannerSource"
  | "watchPageBannerSource"
  | "weeklyFeaturedEnabled"
  | "midrollEnabled"
  | "midrollIntervalSeconds"
  | "monetizationEnabled"
  | "monetizationRequiredSubscribers"
  | "monetizationRequiredVideoViews"
  | "monetizationRequiredShortViews"
  | "monetizationRequireBoth"
  | "monetizationRequireGoodStanding"
  | "monetizationCreatorShare"
  | "monetizationPlatformShare"
>;

async function readPlatformSettings(): Promise<PlatformSettings> {
  try {
    const result = await docClient.send(
      new GetCommand({ TableName: PLATFORM_SETTINGS_TABLE, Key: { settingsId: "global" } })
    );
    if (!result.Item) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(result.Item as Partial<PlatformSettings>) };
  } catch (err) {
    console.error("platformSettings: read failed (table may not exist yet):", err);
    return DEFAULT_SETTINGS;
  }
}

// Global settings are read by the root layout and several hot API paths.
// Cache the one-row lookup briefly, then invalidate it immediately whenever
// an admin changes settings so control-plane updates remain visible at once.
const getCachedPlatformSettings = unstable_cache(
  readPlatformSettings,
  [PLATFORM_SETTINGS_TAG],
  { revalidate: 30, tags: [PLATFORM_SETTINGS_TAG] }
);

export async function getPlatformSettings(): Promise<PlatformSettings> {
  return getCachedPlatformSettings();
}

export async function updatePlatformSettings(
  partial: Partial<PlatformSettings>,
  updatedBy: string
): Promise<PlatformSettings> {
  // Read the source of truth here instead of the cached public value: two
  // admins saving close together must not overwrite each other's settings.
  const current = await readPlatformSettings();
  const updated: PlatformSettings = {
    ...current,
    ...partial,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await docClient.send(
    new PutCommand({
      TableName: PLATFORM_SETTINGS_TABLE,
      Item: { settingsId: "global", ...updated },
    })
  );

  revalidateTag(PLATFORM_SETTINGS_TAG, "max");

  return updated;
}

export function toPublicSettings(settings: PlatformSettings): PublicPlatformSettings {
  return {
    inplayerMaintenanceMode: settings.inplayerMaintenanceMode,
    inplayerMaintenanceMessage: settings.inplayerMaintenanceMessage,
    hammartMaintenanceMode: settings.hammartMaintenanceMode,
    hammartMaintenanceMessage: settings.hammartMaintenanceMessage,
    sponsorshipMaintenanceMode: settings.sponsorshipMaintenanceMode,
    sponsorshipMaintenanceMessage: settings.sponsorshipMaintenanceMessage,
    signupsEnabled: settings.signupsEnabled,
    inplayerAnnouncementEnabled: settings.inplayerAnnouncementEnabled,
    inplayerAnnouncementText: settings.inplayerAnnouncementText,
    inplayerAnnouncementLinkUrl: settings.inplayerAnnouncementLinkUrl || "",
    hammartAnnouncementEnabled: settings.hammartAnnouncementEnabled,
    hammartAnnouncementText: settings.hammartAnnouncementText,
    hammartAnnouncementLinkUrl: settings.hammartAnnouncementLinkUrl || "",
    sponsorshipAnnouncementEnabled: settings.sponsorshipAnnouncementEnabled,
    sponsorshipAnnouncementText: settings.sponsorshipAnnouncementText,
    sponsorshipAnnouncementLinkUrl: settings.sponsorshipAnnouncementLinkUrl || "",
    adsenseEnabled: settings.adsenseEnabled,
    adsensePublisherId: settings.adsensePublisherId,
    homepageBannerSource: settings.homepageBannerSource,
    watchPageBannerSource: settings.watchPageBannerSource,
    weeklyFeaturedEnabled: settings.weeklyFeaturedEnabled !== false,
    midrollEnabled: settings.midrollEnabled,
    midrollIntervalSeconds: settings.midrollIntervalSeconds,
    monetizationEnabled: settings.monetizationEnabled,
    monetizationRequiredSubscribers: settings.monetizationRequiredSubscribers,
    monetizationRequiredVideoViews: settings.monetizationRequiredVideoViews,
    monetizationRequiredShortViews: settings.monetizationRequiredShortViews,
    monetizationRequireBoth: settings.monetizationRequireBoth,
    monetizationRequireGoodStanding: settings.monetizationRequireGoodStanding,
    monetizationCreatorShare: settings.monetizationCreatorShare,
    monetizationPlatformShare: settings.monetizationPlatformShare,
  };
}
