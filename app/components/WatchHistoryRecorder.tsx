"use client";

import { useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { useAuthModal } from "./auth/AuthProvider";
import { useSettings } from "./settings/SettingsProvider";

interface WatchHistoryRecorderProps {
  videoId: string;
}

// Renders nothing — just records "this user watched this video" once,
// the moment the watch page loads, for signed-in users who have Settings →
// Privacy → "Save your viewing history across devices" turned on (the real
// Settings toggle, previously saved but never actually consulted anywhere).
// Waits for `ready` (Settings finished hydrating from localStorage) before
// deciding, so a user who turned history OFF never gets one extra recording
// slip through during the brief moment before their saved preference loads.
export default function WatchHistoryRecorder({ videoId }: WatchHistoryRecorderProps) {
  const { signedIn } = useAuthModal();
  const { privacy, ready } = useSettings();

  useEffect(() => {
    if (!signedIn || !ready || !privacy.watchHistory) return;

    async function record() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();

        await fetch("/api/history", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ videoId }),
        });
      } catch (err) {
        console.error("Failed to record watch history:", err);
      }
    }

    record();
  }, [videoId, signedIn, ready, privacy.watchHistory]);

  return null;
}
