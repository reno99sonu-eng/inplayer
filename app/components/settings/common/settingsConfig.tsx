import {
  Palette,
  Settings,
  PlayCircle,
  Shield,
  CreditCard,
  BarChart3,
  HardDrive,
  Info,
  type LucideIcon,
} from "lucide-react";

// Single source of truth for which sections exist in Settings — used by
// both the desktop sidebar and the mobile tab strip, so they can never
// drift out of sync with each other. (Notifications intentionally removed
// per product decision — the section, its sidebar entry and its mobile
// tab are all gone, not just hidden.)

export type Section =
  | "appearance"
  | "general"
  | "playback"
  | "privacy"
  | "payments"
  | "analytics"
  | "storage"
  | "about";

export interface SettingsSectionItem {
  id: Section;
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
}

export const SETTINGS_SECTIONS: SettingsSectionItem[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "general", label: "General", icon: Settings },
  { id: "playback", label: "Playback", icon: PlayCircle },
  {
    id: "privacy",
    label: "Account & Privacy",
    mobileLabel: "Privacy",
    icon: Shield,
  },
  {
    id: "payments",
    label: "Plans & Purchases",
    mobileLabel: "Plans",
    icon: CreditCard,
  },
  {
    id: "analytics",
    label: "User Analytics",
    mobileLabel: "Analytics",
    icon: BarChart3,
  },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "about", label: "About", icon: Info },
];
