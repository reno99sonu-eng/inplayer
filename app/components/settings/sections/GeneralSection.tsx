"use client";

import { Globe } from "lucide-react";

import SettingsCard from "../common/SettingsCard";
import SettingsRow from "../common/SettingsRow";

// Wired to the real SettingsProvider instead of local-only useState — see
// PrivacySection.tsx for the same fix and why it matters. "Earn Stars" was
// removed outright rather than wired up: it had no onClick, no destination
// page, and no backing feature anywhere in the app, so it was a dead link
// dressed up to look like a real settings row (chevron and all).
//
// Restricted Mode and Child Mode used to live here, disabled and marked
// "Coming soon", because actually hiding mature content needed a real
// content-classification system that didn't exist — flipping either just
// set a localStorage flag nothing ever read. That system exists now (the
// Audience picker on the upload form + app/lib/contentAccess.ts), so both
// have been replaced by the working, passkey-locked toggles in
// ContentAccessSection.tsx, which is its own card on the Settings page.
export default function GeneralSection() {
  return (
    <SettingsCard
      icon={<Globe size={24} />}
      title="General"
      description="Personalize your overall InPlayer experience."
    >
      <div className="space-y-2">

        <SettingsRow
          icon={<Globe size={20} />}
          title="Language"
          description="InPlayer is currently available in English only."
          value="English"
        />

      </div>
    </SettingsCard>
  );
}