import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

export const PLATFORM_SETTINGS_TABLE = "InPlayer-Platform-Settings";

export type AdSlotSource = "house" | "adsense" | "off";

export interface PlatformSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  signupsEnabled: boolean;
  announcementEnabled: boolean;
  announcementText: string;
  moderationEnabledComments: boolean;
  moderationEnabledMessages: boolean;
  moderationEnabledUploads: boolean;
  adsenseEnabled: boolean;
  adsensePublisherId: string;
  homepageBannerSource: AdSlotSource;
  watchPageBannerSource: AdSlotSource;
  homepageSpotlightSource: AdSlotSource;
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
  moderationEnabledComments: true,
  moderationEnabledMessages: true,
  moderationEnabledUploads: true,
  adsenseEnabled: false,
  adsensePublisherId: "",
  homepageBannerSource: "house",
  watchPageBannerSource: "house",
  homepageSpotlightSource: "off",
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
  | "adsenseEnabled"
  | "adsensePublisherId"
  | "homepageBannerSource"
  | "watchPageBannerSource"
  | "homepageSpotlightSource"
  | "weeklyFeaturedEnabled"
  | "midrollEnabled"
  | "midrollIntervalSeconds"
>;

export async function getPlatformSettings(): Promise<PlatformSettings> {
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

export async function updatePlatformSettings(
  partial: Partial<PlatformSettings>,
  updatedBy: string
): Promise<PlatformSettings> {
  const current = await getPlatformSettings();
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

  return updated;
}

export function toPublicSettings(settings: PlatformSettings): PublicPlatformSettings {
  return {
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
    signupsEnabled: settings.signupsEnabled,
    announcementEnabled: settings.announcementEnabled,
    announcementText: settings.announcementText,
    adsenseEnabled: settings.adsenseEnabled,
    adsensePublisherId: settings.adsensePublisherId,
    homepageBannerSource: settings.homepageBannerSource,
    watchPageBannerSource: settings.watchPageBannerSource,
    homepageSpotlightSource: settings.homepageSpotlightSource,
    weeklyFeaturedEnabled: settings.weeklyFeaturedEnabled !== false,
    midrollEnabled: settings.midrollEnabled,
    midrollIntervalSeconds: settings.midrollIntervalSeconds,
  };
}
