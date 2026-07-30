"use client";

import { useEffect, useState } from "react";
import type { PublicPlatformSettings } from "@/app/lib/platformSettings";

// One shared fetch of the public settings row (GET /api/platform-settings,
// unauthenticated) for every client component that needs to react to a
// platform toggle — the maintenance splash, the announcement banner, the
// sign-up gate, and the ad banners. Not wrapped in React Context since
// each of these mounts in a different, unrelated part of the tree; a
// second network round-trip per mount is cheap for a tiny JSON row and
// keeps each consumer independent.
export function usePlatformSettings() {
  const [settings, setSettings] = useState<PublicPlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/platform-settings");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setSettings(data);
      } catch (err) {
        console.error("Failed to load platform settings:", err);
        // Fail open — if the settings row can't be read, the site should
        // behave exactly as if every toggle were off/default, never lock
        // real visitors out over a transient fetch error.
        if (!cancelled) setSettings(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loading };
}
