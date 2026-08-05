"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import AnnouncementBanner from "./AnnouncementBanner";
import MobileBottomNav from "./MobileBottomNav";
import MaintenanceGate from "./MaintenanceGate";
import SplashScreen from "./SplashScreen";

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
  initialMaintenanceMode,
  initialMaintenanceMessage,
}: {
  children: ReactNode;
  // Server-fetched in app/layout.tsx and threaded down here so
  // MaintenanceGate can render the correct state on the very first paint —
  // see the comment on MaintenanceGate's own props for why.
  initialMaintenanceMode: boolean;
  initialMaintenanceMessage: string;
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
      <MaintenanceGate
        initialMaintenanceMode={initialMaintenanceMode}
        initialMaintenanceMessage={initialMaintenanceMessage}
      >
        <Navbar />
        <AnnouncementBanner />
        <div className="pb-20 lg:pb-0">{children}</div>
        <MobileBottomNav />
      </MaintenanceGate>
    </>
  );
}
