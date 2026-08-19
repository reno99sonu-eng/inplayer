"use client";

import { useEffect, useState, ReactNode } from "react";
import { Globe } from "lucide-react";
import { isSearchCrawler } from "@/app/lib/searchCrawlers";

// ──────────────────────────────────────────────────────────────────────
// GEO-RESTRICTION CLIENT GATE — Layers 2 & 3
// ──────────────────────────────────────────────────────────────────────
// Layer 1 (Edge Middleware → middleware.ts) already blocked non-Indian IPs
// before the page even loaded. This component adds two more defense
// layers that run client-side after the page mounts:
//
// Layer 2 — VPN/proxy/datacenter detection: calls GET /api/geo/verify,
//   which queries ip-api.com to check if the connecting IP is a known
//   VPN, proxy, or datacenter address. Even if a VPN routes through an
//   Indian server (passing Layer 1), the IP is flagged as hosting/
//   datacenter and blocked here.
//
// Layer 3 — Browser Geolocation API (GPS): on first visit, requests the
//   user's real GPS coordinates. VPNs change your IP but CANNOT fake GPS.
//   If the coordinates are outside India's bounding box, access is
//   blocked. Desktop users who deny the prompt fall back to IP-only
//   verification (Layers 1 + 2 already validated).
//
// Results are cached in localStorage for 24h to avoid re-prompting or
// re-checking on every page load.
// ──────────────────────────────────────────────────────────────────────

const GEO_CACHE_KEY = "inplayer-geo-verified";
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// India's rough geographic bounding box
const INDIA_LAT_MIN = 6.0;
const INDIA_LAT_MAX = 37.5;
const INDIA_LNG_MIN = 68.0;
const INDIA_LNG_MAX = 97.5;

interface GeoCacheEntry {
  allowed: boolean;
  checkedAt: number;
}

function getCachedResult(): GeoCacheEntry | null {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const entry: GeoCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.checkedAt < GEO_CACHE_TTL_MS) return entry;
    // Expired
    localStorage.removeItem(GEO_CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

function cacheResult(allowed: boolean) {
  try {
    const entry: GeoCacheEntry = { allowed, checkedAt: Date.now() };
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Storage disabled — not fatal, just means we re-check next visit.
  }
}

function isInsideIndia(lat: number, lng: number): boolean {
  return (
    lat >= INDIA_LAT_MIN &&
    lat <= INDIA_LAT_MAX &&
    lng >= INDIA_LNG_MIN &&
    lng <= INDIA_LNG_MAX
  );
}

export default function GeoGate({
  children,
  initialGeoAllowed,
}: {
  children: ReactNode;
  // Server-known value from the Vercel edge header — used as the
  // first-paint answer so the block screen doesn't flash on Indian users
  // (same pattern as MaintenanceGate's initialMaintenanceMode).
  initialGeoAllowed: boolean;
}) {
  const [allowed, setAllowed] = useState(initialGeoAllowed);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Search crawlers and link-preview bots skip Layers 2 and 3 entirely.
    //
    // Googlebot RENDERS JavaScript, so without this it would sail past the
    // middleware exemption and then be blocked here instead: /api/geo/verify
    // would flag its US datacenter IP as hosting, and there is obviously no
    // GPS in a crawler. The rendered page Google finally indexed would still
    // be "Sorry, we're not available in your region yet".
    //
    // Layers 2 and 3 exist to catch a HUMAN using a VPN. A crawler is not
    // one, so they are skipped.
    //
    // BE HONEST ABOUT WHAT THIS COSTS: together with the middleware
    // exemption, this means a person outside India who sets their browser's
    // user-agent string to contain "Googlebot" bypasses all three layers.
    // A user-agent is a self-reported string; no layer that trusts it can
    // be spoof-proof. That hole is the unavoidable price of being findable
    // on Google at all, and every geo-restricted site pays it — but it is a
    // real hole, not one GeoGate closes.
    //
    // If it ever needs closing, the fix is to stop trusting the string and
    // verify the CLIENT: check the connecting IP against Google's published
    // crawler ranges (developers.google.com/search/apis/ipranges/googlebot.json)
    // or do a reverse-DNS lookup on it. Keep this token list narrow until
    // then — every entry added is another word someone can put in a header.
    if (isSearchCrawler(navigator.userAgent)) {
      setAllowed(true);
      return;
    }

    // Server already said non-Indian IP → stay blocked, skip all checks
    if (!initialGeoAllowed) {
      setAllowed(false);
      return;
    }

    // Check localStorage cache first
    const cached = getCachedResult();
    if (cached) {
      setAllowed(cached.allowed);
      if (!cached.allowed) return;
      // Cached as allowed — no more checks needed
      return;
    }

    // No cache → run Layer 2 (VPN detection) + Layer 3 (GPS)
    let cancelled = false;

    async function runGeoChecks() {
      setChecking(true);

      // ── Layer 2: VPN/proxy/datacenter detection ──
      try {
        const res = await fetch("/api/geo/verify", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.allowed === false) {
            // IP flagged as VPN/proxy/datacenter — block
            if (!cancelled) {
              setAllowed(false);
              cacheResult(false);
              setChecking(false);
            }
            return;
          }
        }
        // API failed or returned allowed → continue to Layer 3
      } catch {
        // API unreachable — fail open (Layer 1 already validated IP country)
      }

      // ── Layer 3: Browser GPS verification ──
      if ("geolocation" in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000, // Accept cached position up to 5 min old
              });
            }
          );

          const { latitude, longitude } = position.coords;
          const inside = isInsideIndia(latitude, longitude);

          if (!inside) {
            // GPS says outside India — block even if IP said India (VPN detected)
            if (!cancelled) {
              setAllowed(false);
              cacheResult(false);
              setChecking(false);
            }

            // Also tell the server about the GPS result (best-effort)
            try {
              await fetch("/api/geo/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ latitude, longitude }),
              });
            } catch {
              // Best effort — don't block on this
            }
            return;
          }

          // GPS inside India — verified! Cache and allow.
          if (!cancelled) {
            cacheResult(true);
            setAllowed(true);
            setChecking(false);
          }

          // Store the GPS verification on the server (best-effort)
          try {
            await fetch("/api/geo/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ latitude, longitude }),
            });
          } catch {
            // Best effort
          }
          return;
        } catch {
          // User denied GPS or device has no GPS (desktop) → fall back to
          // IP-only verification (Layers 1 + 2 already passed). This is
          // the practical choice for desktops without GPS hardware.
        }
      }

      // GPS unavailable/denied → IP checks passed, allow through
      if (!cancelled) {
        cacheResult(true);
        setAllowed(true);
        setChecking(false);
      }
    }

    runGeoChecks();
    return () => {
      cancelled = true;
    };
  }, [initialGeoAllowed]);

  // ── Blocked state: render the geo-restriction splash ──
  if (!allowed && !checking) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#06101D] px-6 text-center light:bg-[#F5EEDC]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-orange-400/30 bg-orange-500/10">
          <Globe size={28} className="text-orange-300" />
        </div>
        <h1 className="mt-5 text-2xl font-black text-white light:text-slate-900">
          Sorry, we&apos;re not available in your region yet
        </h1>
        <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-600">
          InPlayer is currently available only in India. We&apos;re working
          hard to expand to more regions soon.
        </p>
        <p className="mt-6 text-xs text-slate-600 light:text-slate-500">
          If you believe this is an error, please contact support.
        </p>
      </div>
    );
  }

  // Allowed (or still checking — show content while Layer 2/3 run in
  // the background so Indian users never see a loading flash)
  return <>{children}</>;
}
