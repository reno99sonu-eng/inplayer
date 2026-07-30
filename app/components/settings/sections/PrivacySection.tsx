"use client";

import {
  Shield,
  Eye,
  Lock,
  UserCheck,
} from "lucide-react";

import SettingsCard from "../common/SettingsCard";
import SettingsRow from "../common/SettingsRow";
import SettingsToggle from "../common/SettingsToggle";
import { useSettings } from "../SettingsProvider";
import DeleteAccountCard from "./DeleteAccountCard";
import SessionsCard from "./SessionsCard";

// Wired to the real SettingsProvider (persisted to localStorage, read by
// useSettings() anywhere in the app — see RecommendationFeed.tsx for a
// live consumer) instead of local-only useState. Every toggle here used
// to reset to its default on every refresh/navigation and had zero
// effect anywhere else in the app.
export default function PrivacySection() {
  const { privacy, updatePrivacy } = useSettings();

  return (
    <SettingsCard
      icon={<Shield size={24} />}
      title="Account & Privacy"
      description="Manage your privacy, security and account visibility."
    >
      <div className="space-y-2">

        <SettingsRow
          icon={<Eye size={20} />}
          title="Private Account"
          description="Only approved followers can view your profile."
        >
          <SettingsToggle
            checked={privacy.privateAccount}
            onChange={(checked) => updatePrivacy({ privateAccount: checked })}
          />
        </SettingsRow>

        <SettingsRow
          icon={<UserCheck size={20} />}
          title="Watch History"
          description="Save your viewing history across devices."
        >
          <SettingsToggle
            checked={privacy.watchHistory}
            onChange={(checked) => updatePrivacy({ watchHistory: checked })}
          />
        </SettingsRow>

        <SettingsRow
          icon={<Lock size={20} />}
          title="Personalized Ads"
          description="Use your activity to improve recommendations."
        >
          <SettingsToggle
            checked={privacy.personalizedAds}
            onChange={(checked) => updatePrivacy({ personalizedAds: checked })}
          />
        </SettingsRow>

      </div>

      <SessionsCard />
      <DeleteAccountCard />
    </SettingsCard>
  );
}