"use client";

import {
  Globe,
  Shield,
  Baby,
  Star,
} from "lucide-react";

import SettingsCard from "../common/SettingsCard";
import SettingsRow from "../common/SettingsRow";
import SettingsToggle from "../common/SettingsToggle";

import { useState } from "react";

export default function GeneralSection() {
  const [restrictedMode, setRestrictedMode] = useState(false);
  const [childMode, setChildMode] = useState(false);

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
          description="Choose the language used by InPlayer."
          value="English"
        />

        <SettingsRow
          icon={<Shield size={20} />}
          title="Restricted Mode"
          description="Hide potentially mature content."
        >
          <SettingsToggle
            checked={restrictedMode}
            onChange={setRestrictedMode}
          />
        </SettingsRow>

        <SettingsRow
          icon={<Baby size={20} />}
          title="Child Mode"
          description="Create a safer experience for children."
        >
          <SettingsToggle
            checked={childMode}
            onChange={setChildMode}
          />
        </SettingsRow>

        <SettingsRow
          icon={<Star size={20} />}
          title="Earn Stars"
          description="Learn how to earn rewards on InPlayer."
          value="Learn More"
        />

      </div>
    </SettingsCard>
  );
}