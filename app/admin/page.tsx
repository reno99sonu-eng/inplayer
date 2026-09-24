"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminIdentity } from "@/app/components/admin/AdminIdentityContext";
import type { TeamPermission } from "@/app/lib/isAdmin";

// The Dashboard's stats API (app/api/admin/dashboard-stats) is
// main-admin-only by design (see app/lib/isAdmin.ts) — a team member who
// landed there (e.g. right after accepting an invitation) would just get a
// permanent 401 with nothing else to do, which is exactly what read as "the
// page doesn't load" after accepting an invite. Same priority order as the
// sidebar's own permission-gated items (AdminSidebar.tsx/AdminMobileNav.tsx)
// so a team member always lands on the first section they can actually use.
const FIRST_ACCESSIBLE_ROUTE: { permission: TeamPermission; href: string }[] = [
  { permission: "view_support", href: "/admin/support" },
  { permission: "view_bugs", href: "/admin/bug-reports" },
  { permission: "view_errors", href: "/admin/error-logs" },
  { permission: "manage_navbar_theme", href: "/admin/navbar-theme" },
  { permission: "manage_ads", href: "/admin/advertising" },
];

// /admin has nothing of its own to show — it just sends you somewhere real,
// the same way visiting a bare /settings would. Which "somewhere" depends on
// who's asking: the main admin always goes to the Dashboard; a team member
// goes to the first section their granted permissions actually unlock.
export default function AdminIndexPage() {
  const router = useRouter();
  const { isMainAdmin, permissions } = useAdminIdentity();

  useEffect(() => {
    if (isMainAdmin) {
      router.replace("/admin/dashboard");
      return;
    }

    const firstMatch = FIRST_ACCESSIBLE_ROUTE.find((entry) => permissions.has(entry.permission));
    router.replace(firstMatch?.href || "/admin/team-member-home");
  }, [router, isMainAdmin, permissions]);

  return null;
}
