"use client";

import {
  Globe,
  Shield,
  Baby,
} from "lucide-react";

import SettingsCard from "../common/SettingsCard";
import SettingsRow from "../common/SettingsRow";
import SettingsToggle from "../common/SettingsToggle";
import { useSettings } from "../SettingsProvider";

// Wired to the real SettingsProvider instead of local-only useState — see
// PrivacySection.tsx for the same fix and why it matters. "Earn Stars" was
// removed outright rather than wired up: it had no onClick, no destination
// page, and no backing feature anywhere in the app, so it was a dead link
// dressed up to look like a real settings row (chevron and all).
//
// Restricted Mode / Child Mode below are marked "Coming soon" and
// disabled rather than wired up — actually hiding mature content or
// creating a safer child experience needs a real content-classification
// system (per-video maturity ratings, moderation review) that doesn't
// exist yet. Flipping the switch used to just flip a localStorage flag
// nothing else ever read.
export default function GeneralSection() {
  const { general, updateGeneral } = useSettings();

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

        <SettingsRow
          icon={<Shield size={20} />}
          title="Restricted Mode"
          description="Coming soon — hide potentially mature content."
        >
          <SettingsToggle
            checked={general.restrictedMode}
            onChange={(checked) => updateGeneral({ restrictedMode: checked })}
            disabled
          />
        </SettingsRow>

        <SettingsRow
          icon={<Baby size={20} />}
          title="Child Mode"
          description="Coming soon — create a safer experience for children."
        >
          <SettingsToggle
            checked={general.childMode}
            onChange={(checked) => updateGeneral({ childMode: checked })}
            disabled
          />
        </SettingsRow>

      </div>
    </SettingsCard>
  );
}