import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { getPlatformSettings, updatePlatformSettings, PlatformSettings } from "@/app/lib/platformSettings";
import { logAdminAction } from "@/app/lib/auditLog";

const AD_SLOT_SOURCES = ["house", "adsense", "off"];

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getPlatformSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Build the partial update from only recognized, correctly-typed fields
  // — never trust the request body wholesale into a DynamoDB write.
  const partial: Partial<PlatformSettings> = {};

  // Maintenance mode + announcement are each three independent fields now
  // (one per admin panel — see app/lib/siteDomain.ts and Reno's explicit
  // correction that toggling Hammart's maintenance mode was also taking
  // down InPlayer and Sponsorship). Looping the three domain prefixes
  // instead of writing each block out three times keeps them from quietly
  // drifting out of sync with each other again.
  const DOMAINS = ["inplayer", "hammart", "sponsorship"] as const;
  for (const domain of DOMAINS) {
    const modeKey = `${domain}MaintenanceMode` as const;
    const messageKey = `${domain}MaintenanceMessage` as const;
    const annEnabledKey = `${domain}AnnouncementEnabled` as const;
    const annTextKey = `${domain}AnnouncementText` as const;
    const annLinkKey = `${domain}AnnouncementLinkUrl` as const;

    if (typeof body[modeKey] === "boolean") partial[modeKey] = body[modeKey];
    if (typeof body[messageKey] === "string") {
      partial[messageKey] = body[messageKey].trim().slice(0, 500);
    }
    if (typeof body[annEnabledKey] === "boolean") partial[annEnabledKey] = body[annEnabledKey];
    if (typeof body[annTextKey] === "string") {
      partial[annTextKey] = body[annTextKey].trim().slice(0, 200);
    }
    if (typeof body[annLinkKey] === "string") {
      partial[annLinkKey] = body[annLinkKey].trim().slice(0, 500);
    }
  }

  if (typeof body.signupsEnabled === "boolean") partial.signupsEnabled = body.signupsEnabled;
  if (typeof body.moderationEnabledComments === "boolean") {
    partial.moderationEnabledComments = body.moderationEnabledComments;
  }
  if (typeof body.moderationEnabledMessages === "boolean") {
    partial.moderationEnabledMessages = body.moderationEnabledMessages;
  }
  if (typeof body.moderationEnabledUploads === "boolean") {
    partial.moderationEnabledUploads = body.moderationEnabledUploads;
  }
  if (typeof body.hammartModerationEnabledListings === "boolean") {
    partial.hammartModerationEnabledListings = body.hammartModerationEnabledListings;
  }
  if (typeof body.adsenseEnabled === "boolean") partial.adsenseEnabled = body.adsenseEnabled;
  if (typeof body.adsensePublisherId === "string") {
    partial.adsensePublisherId = body.adsensePublisherId.trim().slice(0, 60);
  }
  if (AD_SLOT_SOURCES.includes(body.homepageBannerSource)) {
    partial.homepageBannerSource = body.homepageBannerSource;
  }
  if (AD_SLOT_SOURCES.includes(body.watchPageBannerSource)) {
    partial.watchPageBannerSource = body.watchPageBannerSource;
  }
  if (typeof body.weeklyFeaturedEnabled === "boolean") {
    partial.weeklyFeaturedEnabled = body.weeklyFeaturedEnabled;
  }
  if (typeof body.midrollEnabled === "boolean") partial.midrollEnabled = body.midrollEnabled;
  if (typeof body.midrollIntervalSeconds === "number" && Number.isFinite(body.midrollIntervalSeconds)) {
    // Floor of 60s — anything shorter turns every video into an ad break
    // every few sentences, which isn't a real product decision anyone
    // would want to be one fat-fingered admin input away from.
    partial.midrollIntervalSeconds = Math.max(60, Math.min(3600, Math.round(body.midrollIntervalSeconds)));
  }

  if (Object.keys(partial).length === 0) {
    return NextResponse.json({ error: "No valid settings provided." }, { status: 400 });
  }

  const updated = await updatePlatformSettings(partial, admin.email);

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "settings.update",
    targetType: "settings",
    targetId: "global",
    details: Object.keys(partial).join(", "),
  });

  return NextResponse.json({ settings: updated });
}
