// Shared "which product am I on" helper — the one place that decides
// whether a given URL belongs to InPlayer, Hammart, or Sponsorship. Added
// so maintenance mode, announcements, and AI moderation can each be scoped
// per admin panel instead of one global switch affecting all three (Reno's
// explicit correction: turning on Hammart's maintenance mode was also
// taking down InPlayer and Sponsorship, which is exactly the bug this
// fixes). Every consumer (MaintenanceGate, AnnouncementBanner, the admin
// Settings/AI Moderation pages) calls this instead of re-deriving its own
// prefix check, so the three domains can never quietly drift out of sync
// with each other.
export type SiteDomain = "inplayer" | "hammart" | "sponsorship";

export function getSiteDomain(pathname: string | null | undefined): SiteDomain {
  if (!pathname) return "inplayer";
  if (pathname.startsWith("/shop")) return "hammart";
  if (pathname.startsWith("/sponsorships")) return "sponsorship";
  return "inplayer";
}

// Screens where NO floating launcher may render — not the AI orb
// (FloatingAIButton.tsx), not the Support Desk bubble
// (support/SupportChatWidget.tsx).
//
// These are full-bleed, self-contained surfaces whose own UI already owns
// the bottom-right corner: the chat composer on Messages, the like/comment/
// share rail and mute control on Shorts, the broadcast controls on Live. A
// floating bubble there doesn't just look wrong — it sits on top of a
// control the person is trying to press.
//
// This matters more than it used to. The AI orb was originally mounted only
// on the homepage, so it could never collide with anything; now that it's
// site-wide, every immersive screen has to opt out explicitly, and this
// list is that opt-out. Add a prefix here rather than adding another
// pathname check inside an individual widget, so the two launchers can't
// drift apart on which screens they respect.
const NO_FLOATING_LAUNCHER_PREFIXES = ["/messages", "/shorts", "/live"];

export function hideFloatingLaunchers(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return NO_FLOATING_LAUNCHER_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

// Shape shared by PlatformSettings and PublicPlatformSettings — picking the
// right domain's maintenance fields out of either type goes through this
// one function so MaintenanceGate never has to know the field-naming
// convention (`${domain}MaintenanceMode`) itself.
export interface DomainMaintenanceFields {
  inplayerMaintenanceMode: boolean;
  inplayerMaintenanceMessage: string;
  hammartMaintenanceMode: boolean;
  hammartMaintenanceMessage: string;
  sponsorshipMaintenanceMode: boolean;
  sponsorshipMaintenanceMessage: string;
}

export function getDomainMaintenance(
  settings: DomainMaintenanceFields,
  domain: SiteDomain
): { mode: boolean; message: string } {
  if (domain === "hammart") {
    return { mode: settings.hammartMaintenanceMode, message: settings.hammartMaintenanceMessage };
  }
  if (domain === "sponsorship") {
    return { mode: settings.sponsorshipMaintenanceMode, message: settings.sponsorshipMaintenanceMessage };
  }
  return { mode: settings.inplayerMaintenanceMode, message: settings.inplayerMaintenanceMessage };
}

export interface DomainAnnouncementFields {
  inplayerAnnouncementEnabled: boolean;
  inplayerAnnouncementText: string;
  inplayerAnnouncementLinkUrl: string;
  hammartAnnouncementEnabled: boolean;
  hammartAnnouncementText: string;
  hammartAnnouncementLinkUrl: string;
  sponsorshipAnnouncementEnabled: boolean;
  sponsorshipAnnouncementText: string;
  sponsorshipAnnouncementLinkUrl: string;
}

export function getDomainAnnouncement(
  settings: DomainAnnouncementFields,
  domain: SiteDomain
): { enabled: boolean; text: string; linkUrl: string } {
  if (domain === "hammart") {
    return {
      enabled: settings.hammartAnnouncementEnabled,
      text: settings.hammartAnnouncementText,
      linkUrl: settings.hammartAnnouncementLinkUrl,
    };
  }
  if (domain === "sponsorship") {
    return {
      enabled: settings.sponsorshipAnnouncementEnabled,
      text: settings.sponsorshipAnnouncementText,
      linkUrl: settings.sponsorshipAnnouncementLinkUrl,
    };
  }
  return {
    enabled: settings.inplayerAnnouncementEnabled,
    text: settings.inplayerAnnouncementText,
    linkUrl: settings.inplayerAnnouncementLinkUrl,
  };
}

export const DOMAIN_LABELS: Record<SiteDomain, string> = {
  inplayer: "InPlayer",
  hammart: "Hammart",
  sponsorship: "Sponsorship",
};
