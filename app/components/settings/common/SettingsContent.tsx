"use client";

import { ReactNode } from "react";
import PlaybackSection from "../sections/PlaybackSection";
import PrivacySection from "../sections/PrivacySection";
import AnalyticsSection from "../sections/AnalyticsSection";
import StorageSection from "../sections/StorageSection";
import AboutSection from "../sections/AboutSection";
import PlansSection from "../sections/PlansSection";

type Section =
  | "appearance"
  | "general"
  | "playback"
  | "privacy"
  | "payments"
  | "analytics"
  | "storage"
  | "about";

interface SettingsContentProps {
  active: Section;
  appearance: ReactNode;
  general: ReactNode;
}

export default function SettingsContent({
  active,
  appearance,
  general,
}: SettingsContentProps) {
  switch (active) {
    case "appearance":
      return appearance;

    case "general":
      return general;

      case "playback":
        return <PlaybackSection />;

        case "privacy":
          return <PrivacySection />;

    case "payments":
      // A real, fully-built Plans & Purchases section (real free-vs-Premium
      // feature comparison, honest "Premium billing launches soon" state on
      // the actual paid tier — see PlansSection.tsx) existed in the codebase
      // but was never wired up here, so every visitor saw this generic,
      // contentless placeholder instead. Not a "coming soon" case at all —
      // the section was done, just not connected.
      return <PlansSection />;

    case "analytics":
      return <AnalyticsSection />;

    case "storage":
      return <StorageSection />;

    case "about":
      return <AboutSection />;

    default:
      return appearance;
  }
}