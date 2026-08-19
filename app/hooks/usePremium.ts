"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/app/lib/apiFetch";
import { FREE_MAX_RESOLUTION, type PlaybackResolution } from "@/app/lib/premium";

export interface PremiumState {
  premium: boolean;
  premiumUntil: string | null;
  /** The best rendition this viewer's tier permits, decided server-side. */
  maxResolution: PlaybackResolution;
  /** False until the first answer arrives — consumers that must not act on
   *  a guess (the player's resolution cap) should wait for this. */
  ready: boolean;
}

const FREE_STATE: Omit<PremiumState, "ready"> = {
  premium: false,
  premiumUntil: null,
  maxResolution: FREE_MAX_RESOLUTION,
};

// Module-level cache. Every video card, the watch player and the Shorts feed
// all want this on the same page load; without the cache a feed of 30 cards
// would fire 30 identical requests. The in-flight promise is shared too, so
// simultaneous first-mounts coalesce into ONE request rather than racing.
let cached: Omit<PremiumState, "ready"> | null = null;
let inFlight: Promise<Omit<PremiumState, "ready">> | null = null;

async function loadPremium(): Promise<Omit<PremiumState, "ready">> {
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await authedFetch("/api/premium/me");
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        cached = {
          premium: Boolean(data.premium),
          premiumUntil: data.premiumUntil || null,
          maxResolution: (data.maxResolution as PlaybackResolution) || FREE_MAX_RESOLUTION,
        };
      } else {
        cached = FREE_STATE;
      }
    } catch {
      // Never let a failed tier lookup break playback — fall back to free,
      // which is the safe direction (a paying viewer briefly capped at
      // 1080p is recoverable; giving 4K away on every network blip isn't).
      cached = FREE_STATE;
    } finally {
      inFlight = null;
    }
    return cached;
  })();

  return inFlight;
}

/** Call after anything that changes the tier (a purchase, a sign-out) so the
 *  next read re-fetches instead of serving a stale answer for the session. */
export function invalidatePremiumCache() {
  cached = null;
  inFlight = null;
}

export function usePremium(): PremiumState {
  const [state, setState] = useState<Omit<PremiumState, "ready">>(cached ?? FREE_STATE);
  const [ready, setReady] = useState(Boolean(cached));

  useEffect(() => {
    let cancelled = false;
    void loadPremium().then((next) => {
      if (cancelled) return;
      setState(next);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, ready };
}
