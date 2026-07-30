import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

// One real row, one true source for every platform-wide toggle the Admin
// Panel's Settings/AI Moderation/Advertising pages expose — a single
// DynamoDB item (settingsId: "global") rather than one table per section,
// since these are all small, related, admin-only config values read
// together far more often than they're written. Every reader (public
// pages, moderation call sites, ad banners) goes through
// getPlatformSettings() below and gets DEFAULT_SETTINGS if the table or
// row doesn't exist yet — same fail-open, "never break the real feature
// over a missing config row" convention as the rest of this app.
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
  homepageBannerSource: "off",
  watchPageBannerSource: "off",
  updatedAt: null,
  updatedBy: null,
};

// The only fields a signed-out visitor (or any non-admin page) is allowed
// to see — deliberately excludes nothing sensitive today (adsensePublisherId
// is meant to be public, it's embedded straight into page HTML for
// AdSense to work at all), but kept as an explicit allowlist rather than
// "return everything" so a future admin-only field doesn't leak by
// accident.
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
  };
}

// Full-row overwrite rather than a partial UpdateExpression — there's
// exactly one writer path (the admin Settings page, one admin account),
// so there's no concurrent-write race to guard against, and always writing
// the complete merged object means a reader can never see a half-updated
// row.
export async function updatePlatformSettings(
  partial: Partial<PlatformSettings>,
  updatedBy: string
): Promise<PlatformSettings> {
  const current = await getPlatformSettings();
  const next: PlatformSettings = {
    ...current,
    ...partial,
    settingsId: "global",
    updatedAt: new Date().toISOString(),
    updatedBy,
  } as PlatformSettings;

  await docClient.send(
    new PutCommand({
      TableName: PLATFORM_SETTINGS_TABLE,
      Item: { settingsId: "global", ...next },
    })
  );

  return next;
}
