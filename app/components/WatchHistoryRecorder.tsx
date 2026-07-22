"use client";

import { useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { useAuthModal } from "./auth/AuthProvider";

interface WatchHistoryRecorderProps {
  videoId: string;
}

// Renders nothing — just records "this user watched this video" once,
// the moment the watch page loads, for signed-in users.
export default function WatchHistoryRecorder({ videoId }: WatchHistoryRecorderProps) {
  const { signedIn } = useAuthModal();

  useEffect(() => {
    if (!signedIn) return;

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
  }, [videoId, signedIn]);

  return null;
}
