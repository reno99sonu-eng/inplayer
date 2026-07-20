"use client";
import { useState } from "react";
import SettingsHeader from "../components/settings/common/SettingsHeader";
import SettingsLayout from "../components/settings/common/SettingsLayout";
import SettingsSidebar from "../components/settings/common/SettingsSidebar";
import SettingsContent from "../components/settings/common/SettingsContent";
import MobileSettingsTabs from "../components/settings/common/MobileSettingsTabs";
import type { Section } from "../components/settings/common/settingsConfig";

export default function SettingsPage() {
  const [activeSection, setActiveSection] =
    useState<Section>("appearance");

  return (
    <div className="min-h-screen bg-[#06101D] text-white">
      <SettingsHeader />

      <>
        {/* Mobile */}
        <div className="lg:hidden px-5 py-8">
          <MobileSettingsTabs
            active={activeSection}
            onChange={setActiveSection}
          />

          <div className="mt-6">
            <SettingsContent active={activeSection} />
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
            <SettingsContent active={activeSection} />
          </SettingsLayout>
        </div>
      </>
    </div>
  );
}
