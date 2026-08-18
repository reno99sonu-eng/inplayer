"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Navbar from "./Navbar";
// Non-critical for first paint — lazy-loaded
const AnnouncementBanner = dynamic(() => import("./AnnouncementBanner"), { ssr: false });
const MobileBottomNav = dynamic(() => import("./MobileBottomNav"), { ssr: false });
// Pure client-side idle watcher with nothing to render until it actually
// fires, so it never needs to be in the server-rendered HTML. It scopes
// itself to the InPlayer domain internally (see the component) rather than
// being conditionally mounted here, so this stays a one-line addition.
const IdleViewerPrompt = dynamic(() => import("./IdleViewerPrompt"), { ssr: false });
// AI Support Desk launcher. Client-only and lazy for the same reason as the
// two above — it renders nothing but a floating button until opened, and it
// picks its own product playbook (InPlayer vs Hammart) off the pathname
// internally, so mounting it once here covers both storefronts.
const SupportChatWidget = dynamic(() => import("./support/SupportChatWidget"), { ssr: false });
import MaintenanceGate from "./MaintenanceGate";
import GeoGate from "./GeoGate";
import SplashScreen from "./SplashScreen";
import type { DomainMaintenanceFields } from "@/app/lib/siteDomain";

// Splits the public site's chrome (top navbar/search/categories, the
// site-wide announcement banner, the mobile bottom tab bar, and the
// maintenance-mode splash) away from the Admin Panel, which has its own
// completely separate header/sidebar (see app/admin/layout.tsx,
// AdminHeader.tsx, AdminSidebar.tsx) and its own sign-in gate. Before this,
// every /admin/* page rendered the ENTIRE public navbar (search, category
// bar, "Your Channel"/subscriptions/downloads drawer, footer links) above
// its own admin header — this is the one place that decides which chrome a
// route gets, so neither tree has to know about the other.
//
// Admin routes also skip the public maintenance splash entirely: an admin
// must always be able to reach /admin to turn maintenance mode back off,
// and app/admin/layout.tsx already does its own real sign-in/authorization
// gating for everyone else who isn't the admin.
export default function SiteChrome({
  children,
  initialMaintenance,
  initialGeoAllowed,
}: {
  children: ReactNode;
  // Server-fetched in app/layout.tsx and threaded down here so
  // MaintenanceGate can render the correct state on the very first paint —
  // see the comment on MaintenanceGate's own props for why. Carries all
  // three panels' fields (InPlayer/Hammart/Sponsorship); MaintenanceGate
  // itself picks out the one that matches the current pathname, since the
  // root layout that fetched this has no pathname access to do that pick
  // itself.
  initialMaintenance: DomainMaintenanceFields;
  // Server-known geo status from Vercel's x-vercel-ip-country header,
  // threaded the same way as initialMaintenance so GeoGate has the
  // correct first-paint answer (Indian users never see a block flash).
  initialGeoAllowed: boolean;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Overlay only — the real chrome/content below still mounts and
          loads normally underneath it, so the splash never delays the
          actual page. */}
      <SplashScreen />
      <MaintenanceGate initialMaintenance={initialMaintenance}>
        <GeoGate initialGeoAllowed={initialGeoAllowed}>
          <Navbar />
          <AnnouncementBanner />
          <div className="pb-20 lg:pb-0">{children}</div>
          <MobileBottomNav />
          <IdleViewerPrompt />
          <SupportChatWidget />
        </GeoGate>
      </MaintenanceGate>
    </>
  );
}
