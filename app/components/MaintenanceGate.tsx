"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Wrench } from "lucide-react";
import { usePlatformSettings } from "@/app/hooks/usePlatformSettings";
import { getSiteDomain, getDomainMaintenance, type DomainMaintenanceFields } from "@/app/lib/siteDomain";

// Real maintenance mode — flip it on from Admin Panel -> Platform Settings
// and EVERY visitor of that ONE panel (InPlayer, Hammart, or Sponsorship —
// whichever the current URL belongs to, per getSiteDomain()) sees the
// splash below instead of the app. The three panels each have their own
// independent switch now (inplayerMaintenanceMode / hammartMaintenanceMode
// / sponsorshipMaintenanceMode — see app/lib/platformSettings.ts): this
// used to be one flat maintenanceMode field gating the whole site at once,
// so turning on Hammart's maintenance mode from the admin panel also took
// InPlayer and Sponsorship down with it — Reno's exact bug report. No
// bypass for the signed-in admin: this used to detect the admin and show
// them the real site with a small amber banner on top instead of the
// splash — Reno flagged that as exactly the wrong behavior ("instead of
// the InPlayer website visible along with the contents"), since it meant
// maintenance mode never actually looked like maintenance mode to him, on
// any device. There's no risk of that leaving him locked out of turning it
// back off: SiteChrome.tsx already routes every /admin/* page around this
// component entirely (its own separate sign-in-gated layout, see
// SiteChrome's own comment), so /admin stays reachable no matter what this
// shows on the public site.
export default function MaintenanceGate({
  children,
  initialMaintenance,
}: {
  children: ReactNode;
  // Server-fetched in app/layout.tsx (via getPlatformSettings(), the same
  // source usePlatformSettings() below reads client-side) — used as the
  // known-correct answer for the window between first paint and this
  // component's own client fetch resolving. Without this, every fresh page
  // load rendered the real site (navbar, homepage, bottom nav) for however
  // long that client fetch took, THEN swapped to the maintenance splash —
  // a flash that's barely visible on a fast desktop connection but stretches
  // out (and reads as "maintenance mode isn't working right") on a slower
  // mobile connection. This makes the very first render already correct on
  // every device, regardless of network speed. Carries all three panels'
  // fields; the domain picked out below (via the current pathname) decides
  // which pair actually gets used.
  initialMaintenance: DomainMaintenanceFields;
}) {
  const pathname = usePathname();
  const domain = getSiteDomain(pathname);
  const { settings, loading: settingsLoading } = usePlatformSettings();

  const initial = getDomainMaintenance(initialMaintenance, domain);
  // Once the client's own fetch resolves, its (always-fresh) value takes
  // over; until then, fall back to the server-known value instead of an
  // "unknown, so just show the real site" default.
  const maintenanceOn = settingsLoading ? initial.mode : Boolean(settings && getDomainMaintenance(settings, domain).mode);
  const maintenanceMessage = settingsLoading
    ? initial.message
    : (settings && getDomainMaintenance(settings, domain).message) || initial.message;

  // Maintenance fully off — render normally, no gate at all.
  if (!maintenanceOn) {
    return <>{children}</>;
  }

  return (
    // min-h-dvh, not min-h-screen (100vh) — 100vh is measured against the
    // largest possible mobile viewport (address bar hidden), so on the
    // very first paint, before the browser settles, the page can render
    // taller than what's actually visible, leaving this centered content
    // looking shifted or clipped depending on the phone/browser chrome —
    // the same class of mobile-only sizing bug already called out and
    // fixed with dvh for the fake-fullscreen video player in this file's
    // globals.css. dvh tracks the real, current visible height instead.
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#06101D] px-6 text-center light:bg-[#F5EEDC]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-orange-400/30 bg-orange-500/10">
        <Wrench size={28} className="text-orange-300" />
      </div>
      <h1 className="mt-5 text-2xl font-black text-white light:text-slate-900">
        Be right back
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-600">
        {maintenanceMessage ||
          "InPlayer is down for scheduled maintenance. We'll be back shortly."}
      </p>
    </div>
  );
}
