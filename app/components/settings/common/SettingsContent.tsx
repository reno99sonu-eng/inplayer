"use client";

import AppearanceSection from "../sections/AppearanceSection";
import GeneralSection from "../sections/GeneralSection";
import PlaybackSection from "../sections/PlaybackSection";
import PrivacySection from "../sections/PrivacySection";
import PlansSection from "../sections/PlansSection";
import AnalyticsSection from "../sections/AnalyticsSection";
import StorageSection from "../sections/StorageSection";
import AboutSection from "../sections/AboutSection";
import type { Section } from "./settingsConfig";

interface SettingsContentProps {
  active: Section;
}

export default function SettingsContent({ active }: SettingsContentProps) {
  // Keyed on `active` so switching sections remounts this wrapper and
  // replays the fade-in animation — a small, smooth transition between
  // tabs instead of an abrupt swap.
  return (
    <div key={active} className="animate-settings-fade">
      {active === "appearance" && <AppearanceSection />}
      {active === "general" && <GeneralSection />}
      {active === "playback" && <PlaybackSection />}
      {active === "privacy" && <PrivacySection />}
      {active === "payments" && <PlansSection />}
      {active === "analytics" && <AnalyticsSection />}
      {active === "storage" && <StorageSection />}
      {active === "about" && <AboutSection />}
    </div>
  );
}
