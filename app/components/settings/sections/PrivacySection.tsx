"use client";

import { useEffect, useRef, useState } from "react";
import {
  Shield,
  Eye,
  Lock,
  UserCheck,
} from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";

import SettingsCard from "../common/SettingsCard";
import SettingsRow from "../common/SettingsRow";
import SettingsToggle from "../common/SettingsToggle";
import { useSettings } from "../SettingsProvider";
import { useAuthModal } from "../../auth/AuthProvider";
import DeleteAccountCard from "./DeleteAccountCard";
import SessionsCard from "./SessionsCard";

// Wired to the real SettingsProvider (persisted to localStorage, read by
// useSettings() anywhere in the app — see RecommendationFeed.tsx for a
// live consumer) instead of local-only useState. Every toggle here used
// to reset to its default on every refresh/navigation and had zero
// effect anywhere else in the app.
//
// Exception: "Private Account" below is NOT one of those localStorage
// settings — account visibility is real, server-side state
// (InPlayer-Users.usernamePrivacy), the same field the Profile page's
// Public/Connections/Private control already sets for real (it gates
// what app/api/users/[username]/route.ts returns to other visitors). This
// toggle is a simplified on/off view onto that same real value: OFF saves
// "public", ON saves "private". A creator who wants the middle
// "Connections" option uses the fuller control on the Profile page — this
// toggle will show as ON for that case too, since anything other than
// fully public counts as "on" here.
export default function PrivacySection() {
  const { privacy, updatePrivacy } = useSettings();
  const { user, refreshUser } = useAuthModal();
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // usernamePrivacy is a THREE-value field — "public" | "connections" |
  // "private" (PRIVACY_VALUES in app/api/profile/settings/route.ts), and the
  // Profile page exposes all three. This toggle can only express two, and
  // previously wrote a flat "private"/"public" — so a creator set to
  // "connections" showed as ON here, and one off/on tap silently rewrote
  // them to "private" with no way back from this screen. getPublicProfile
  // treats those two very differently, so that was real data loss.
  //
  // Fixed by making the toggle non-destructive: it remembers the exact
  // value it turned off from and restores THAT on the way back, and a
  // "connections" account is labelled as such rather than being flattened.
  const currentPrivacy = (user?.usernamePrivacy || "public") as
    | "public"
    | "connections"
    | "private";
  const isPrivate = currentPrivacy !== "public";
  const restrictedModeRef = useRef<"connections" | "private">(
    currentPrivacy === "connections" ? "connections" : "private"
  );

  useEffect(() => {
    if (currentPrivacy !== "public") {
      restrictedModeRef.current = currentPrivacy;
    }
  }, [currentPrivacy]);

  const handlePrivateAccountToggle = async (checked: boolean) => {
    if (savingPrivacy) return;
    setSavingPrivacy(true);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch("/api/profile/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          action: "update_privacy",
          // Restores whichever restricted value was in effect before,
          // instead of always collapsing to "private".
          usernamePrivacy: checked ? restrictedModeRef.current : "public",
        }),
      });

      if (res.ok) {
        await refreshUser();
      }
    } catch (err) {
      console.error("Failed to update account privacy:", err);
    } finally {
      setSavingPrivacy(false);
    }
  };

  return (
    <SettingsCard
      icon={<Shield size={24} />}
      title="Account & Privacy"
      description="Manage your privacy, security and account visibility."
    >
      <div className="space-y-2">

        <SettingsRow
          icon={<Eye size={20} />}
          title={
            currentPrivacy === "connections"
              ? "Restricted Account (Connections only)"
              : "Private Account"
          }
          description="Only approved followers can view your profile."
        >
          <SettingsToggle
            checked={isPrivate}
            onChange={handlePrivateAccountToggle}
            disabled={savingPrivacy}
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
          description="Coming soon — use your activity to improve recommendations."
        >
          <SettingsToggle
            checked={privacy.personalizedAds}
            onChange={(checked) => updatePrivacy({ personalizedAds: checked })}
            disabled
          />
        </SettingsRow>

      </div>

      <SessionsCard />
      <DeleteAccountCard />
    </SettingsCard>
  );
}