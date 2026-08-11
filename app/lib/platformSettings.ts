import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { revalidateTag, unstable_cache } from "next/cache";
import { docClient } from "@/app/lib/dynamodb";

export const PLATFORM_SETTINGS_TABLE = "InPlayer-Platform-Settings";
export const PLATFORM_SETTINGS_TAG = "platform-settings";

export type AdSlotSource = "house" | "adsense" | "off";

export interface PlatformSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  signupsEnabled: boolean;
  announcementEnabled: boolean;
  announcementText: string;
  // Destination for the announcement overlay's CTA button — optional. When
  // empty, the overlay still shows (headline + close button), it just
  // doesn't render a button pointing nowhere real.
  announcementLinkUrl: string;
  moderationEnabledComments: boolean;
  moderationEnabledMessages: boolean;
  moderationEnabledUploads: boolean;
  adsenseEnabled: boolean;
  adsensePublisherId: string;
  homepageBannerSource: AdSlotSource;
  watchPageBannerSource: AdSlotSource;
  weeklyFeaturedEnabled: boolean;
  midrollEnabled: boolean;
  midrollIntervalSeconds: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  maintenanceMode: false,
  maintenanceMessage: "InPlayer is down for scheduled maintenance. We'll be back shortly.",
  signupsEnabled: true,
  announcementEnabled: false,
  announcementText: "",
  announcementLinkUrl: "",
  moderationEnabledComments: true,
  moderationEnabledMessages: true,
  moderationEnabledUploads: true,
  adsenseEnabled: false,
  adsensePublisherId: "",
  homepageBannerSource: "house",
  watchPageBannerSource: "house",
  weeklyFeaturedEnabled: true, // ON by default
  midrollEnabled: true,
  midrollIntervalSeconds: 900,
  updatedAt: null,
  updatedBy: null,
};

export type PublicPlatformSettings = Pick<
  PlatformSettings,
  | "maintenanceMode"
  | "maintenanceMessage"
  | "signupsEnabled"
  | "announcementEnabled"
  | "announcementText"
  | "announcementLinkUrl"
  | "adsenseEnabled"
  | "adsensePublisherId"
  | "homepageBannerSource"
  | "watchPageBannerSource"
  | "weeklyFeaturedEnabled"
  | "midrollEnabled"
  | "midrollIntervalSeconds"
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
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
    signupsEnabled: settings.signupsEnabled,
    announcementEnabled: settings.announcementEnabled,
    announcementText: settings.announcementText,
    announcementLinkUrl: settings.announcementLinkUrl || "",
    adsenseEnabled: settings.adsenseEnabled,
    adsensePublisherId: settings.adsensePublisherId,
    homepageBannerSource: settings.homepageBannerSource,
    watchPageBannerSource: settings.watchPageBannerSource,
    weeklyFeaturedEnabled: settings.weeklyFeaturedEnabled !== false,
    midrollEnabled: settings.midrollEnabled,
    midrollIntervalSeconds: settings.midrollIntervalSeconds,
  };
}
