"use client";

import { useState } from "react";
import {
  Shield,
  Eye,
  Lock,
  UserCheck,
  Fingerprint,
} from "lucide-react";

import SettingsCard from "../common/SettingsCard";
import SettingsRow from "../common/SettingsRow";
import SettingsToggle from "../common/SettingsToggle";

export default function PrivacySection() {
  const [privateAccount, setPrivateAccount] = useState(false);
  const [watchHistory, setWatchHistory] = useState(true);
  const [personalizedAds, setPersonalizedAds] = useState(true);
  const [biometricLogin, setBiometricLogin] = useState(true);

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
            checked={privateAccount}
            onChange={setPrivateAccount}
          />
        </SettingsRow>

        <SettingsRow
          icon={<UserCheck size={20} />}
          title="Watch History"
          description="Save your viewing history across devices."
        >
          <SettingsToggle
            checked={watchHistory}
            onChange={setWatchHistory}
          />
        </SettingsRow>

        <SettingsRow
          icon={<Lock size={20} />}
          title="Personalized Ads"
          description="Use your activity to improve recommendations."
        >
          <SettingsToggle
            checked={personalizedAds}
            onChange={setPersonalizedAds}
          />
        </SettingsRow>

        <SettingsRow
          icon={<Fingerprint size={20} />}
          title="Biometric Login"
          description="Use Face ID or fingerprint when available."
        >
          <SettingsToggle
            checked={biometricLogin}
            onChange={setBiometricLogin}
          />
        </SettingsRow>

      </div>
    </SettingsCard>
  );
}