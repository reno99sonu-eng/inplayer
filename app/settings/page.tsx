"use client";
// NOTE: the Content access card (18+ / Kids only) used to render here
// alongside GeneralSection. It now lives in the hamburger drawer —
// app/components/ContentAccessMenu.tsx — so it is one tap from anywhere
// rather than three taps into a settings tab.
// app/components/settings/sections/ContentAccessSection.tsx is the old
// version and is no longer imported by anything; safe to delete.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SettingsHeader from "../components/settings/common/SettingsHeader";
import SettingsLayout from "../components/settings/common/SettingsLayout";
import SettingsSidebar from "../components/settings/common/SettingsSidebar";
import SettingsContent from "../components/settings/common/SettingsContent";
import AppearanceSection from "../components/settings/sections/AppearanceSection";
import GeneralSection from "../components/settings/sections/GeneralSection";
import MobileSettingsTabs from "../components/settings/common/MobileSettingsTabs";

type Section =
  | "appearance"
  | "general"
  | "playback"
  | "privacy"
  | "payments"
  | "analytics"
  | "storage"
  | "about";

const VALID_SECTIONS: Section[] = [
  "appearance",
  "general",
  "playback",
  "privacy",
  "payments",
  "analytics",
  "storage",
  "about",
];

function SettingsContentWrapper() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") || searchParams.get("section");
  const [activeSection, setActiveSection] = useState<Section>(() => {
    if (tabParam && VALID_SECTIONS.includes(tabParam as Section)) {
      return tabParam as Section;
    }
    return "appearance";
  });

  useEffect(() => {
    if (tabParam && VALID_SECTIONS.includes(tabParam as Section)) {
      setActiveSection(tabParam as Section);
    }
  }, [tabParam]);

  return (
    <>
      {/* Mobile */}
      <div className="lg:hidden px-5 py-8">
        <MobileSettingsTabs
          active={activeSection}
          onChange={setActiveSection}
        />

        <div className="mt-6">
          <SettingsContent
            active={activeSection}
            appearance={<AppearanceSection />}
            general={<GeneralSection />}
          />
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden lg:block">
        <SettingsLayout
          sidebar={
            <SettingsSidebar
              active={activeSection}
              onChange={setActiveSection}
            />
          }
        >
          <SettingsContent
            active={activeSection}
            appearance={<AppearanceSection />}
            general={<GeneralSection />}
          />
        </SettingsLayout>
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[#06101D] light:bg-transparent text-white light:text-slate-900">
      <SettingsHeader />
      <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading settings...</div>}>
        <SettingsContentWrapper />
      </Suspense>
    </div>
  );
}