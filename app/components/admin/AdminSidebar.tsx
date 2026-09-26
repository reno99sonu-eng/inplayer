"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Star,
  Video,
  Film,
  Flag,
  Copyright,
  IndianRupee,
  DollarSign,
  Megaphone,
  Palette,
  BarChart3,
  Bot,
  Bell,
  Settings,
  ScrollText,
  Wrench,
  Store,
  Bug,
  ShoppingBag,
  AlertTriangle,
  AlertOctagon,
  Receipt,
  LifeBuoy,
  Music2,
  UserCog,
} from "lucide-react";
import { useAdminMode, type AdminMode } from "@/app/components/admin/AdminModeContext";
import { useAdminIdentity } from "@/app/components/admin/AdminIdentityContext";
import type { TeamPermission } from "@/app/lib/isAdmin";

// Three section lists, one per AdminMode (see AdminModeContext + the
// switcher in AdminHeader). Each mode's own items stay out of the other
// two lists — that's the actual "separate, independent admin sections"
// Reno asked for, not just one more flat sidebar row. Advertising (house
// ads + AdSense) moved here from the InPlayer list into Sponsorship's —
// both House/AdSense ads and paid sponsor campaigns feed the exact same
// rendering slots (see app/api/ads/route.ts), so they belong under one
// "Sponsorship" roof even though only one of the two involves an outside
// sponsor paying InPlayer.
// `permission`: which TEAM_PERMISSION unlocks this item for a team member.
// Omitted entirely -> main-admin-only, hidden from every team member
// regardless of what they were granted (see the filtering in the
// component below). Only items backed by a route actually retrofitted
// with requirePermission() (app/lib/isAdmin.ts) carry one.
const inplayerItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/admin/dashboard" },
  { id: "users", label: "Users", icon: Users, href: "/admin/users" },
  { id: "creators", label: "Creators", icon: Star, href: "/admin/creators" },
  { id: "support", label: "Support Desk", icon: LifeBuoy, href: "/admin/support", permission: "view_support" },
  { id: "bug-reports", label: "Bug Reports", icon: Bug, href: "/admin/bug-reports", permission: "view_bugs" },
  { id: "error-logs", label: "Error Logs", icon: AlertTriangle, href: "/admin/error-logs", permission: "view_errors" },
  { id: "videos", label: "Videos", icon: Video, href: "/admin/videos" },
  { id: "shorts", label: "Shorts", icon: Film, href: "/admin/videos?type=short" },
  { id: "music", label: "Music Studio", icon: Music2, href: "/admin/music" },
  { id: "stuck-processing", label: "Stuck Uploads", icon: AlertOctagon, href: "/admin/stuck-processing", permission: "delete_stuck_processing_videos" },
  { id: "reports", label: "Reports & Moderation", icon: Flag, href: "/admin/moderation", permission: "view_reports" },
  { id: "copyright", label: "Copyright Center", icon: Copyright, href: "/admin/copyright" },
  { id: "revenue", label: "Revenue", icon: DollarSign, href: "/admin/revenue" },
  { id: "navbar-theme", label: "Navbar Theme", icon: Palette, href: "/admin/navbar-theme", permission: "manage_navbar_theme" },
  { id: "analytics", label: "Analytics", icon: BarChart3, href: "/admin/analytics" },
  { id: "ai-moderation", label: "AI Moderation", icon: Bot, href: "/admin/ai-moderation" },
  { id: "notifications", label: "Notifications", icon: Bell, href: "/admin/notifications" },
  { id: "settings", label: "Platform Settings", icon: Settings, href: "/admin/settings" },
  { id: "monetization-settings", label: "Monetization Config", icon: IndianRupee, href: "/admin/monetization-settings" },
  { id: "audit-logs", label: "Audit Logs", icon: ScrollText, href: "/admin/audit-logs" },
  { id: "captions", label: "Maintenance", icon: Wrench, href: "/admin/captions" },
  { id: "team", label: "Team Members", icon: UserCog, href: "/admin/team" },
] as const;

const hammartItems = [
  { id: "hammart-vendors", label: "Vendors & KYC", icon: Store, href: "/admin/hammart-vendors" },
  { id: "hammart-products", label: "Products", icon: ShoppingBag, href: "/admin/hammart-products" },
  { id: "hammart-orders", label: "Orders", icon: Receipt, href: "/admin/hammart-orders" },
  { id: "ai-moderation", label: "AI Moderation", icon: Bot, href: "/admin/ai-moderation" },
  { id: "support", label: "Support Desk", icon: LifeBuoy, href: "/admin/support", permission: "view_support" },
  { id: "bug-reports", label: "Bug Reports", icon: Bug, href: "/admin/bug-reports", permission: "view_bugs" },
  { id: "error-logs", label: "Error Logs", icon: AlertTriangle, href: "/admin/error-logs", permission: "view_errors" },
  { id: "settings", label: "Platform Settings", icon: Settings, href: "/admin/settings" },
  { id: "audit-logs", label: "Audit Logs", icon: ScrollText, href: "/admin/audit-logs" },
] as const;

const sponsorshipItems = [
  { id: "sponsorships", label: "Sponsorships", icon: Receipt, href: "/admin/sponsorships" },
  { id: "ads", label: "House Ads & AdSense", icon: Megaphone, href: "/admin/advertising", permission: "manage_ads" },
  { id: "bug-reports", label: "Bug Reports", icon: Bug, href: "/admin/bug-reports", permission: "view_bugs" },
  { id: "error-logs", label: "Error Logs", icon: AlertTriangle, href: "/admin/error-logs", permission: "view_errors" },
  { id: "settings", label: "Platform Settings", icon: Settings, href: "/admin/settings" },
  { id: "audit-logs", label: "Audit Logs", icon: ScrollText, href: "/admin/audit-logs" },
] as const;

// Where a team member lands when entering a mode: the first item that mode's
// sidebar would actually show them. The main admin's per-mode home pages
// (dashboard, vendor KYC, sponsorship orders) are all main-admin-only, so
// sending a team member there only produces a 401.
export function teamMemberHomeHref(mode: AdminMode, permissions: Set<string>): string {
  const modeItems: readonly { href: string; permission?: string }[] =
    mode === "hammart" ? hammartItems : mode === "sponsorship" ? sponsorshipItems : inplayerItems;
  const first = modeItems.find((item) => item.permission && permissions.has(item.permission));
  return first?.href ?? "/admin/team-member-home";
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mode } = useAdminMode();
  const { isMainAdmin, permissions } = useAdminIdentity();
  const modeItems = mode === "hammart" ? hammartItems : mode === "sponsorship" ? sponsorshipItems : inplayerItems;
  // Main admin sees every item, unchanged. A team member sees ONLY items
  // whose `permission` they were actually granted — "team" (main-admin-only
  // management of team members itself) and every item with no `permission`
  // at all (dashboard, users, videos, revenue, settings, ...) are hidden,
  // not just disabled, so a team member never lands on a page that only
  // shows an "Unauthorized" error.
  const items = isMainAdmin
    ? modeItems
    : modeItems.filter(
        (item) =>
          item.id !== "team" &&
          "permission" in item &&
          permissions.has(item.permission as TeamPermission)
      );
  // Full current path including query (e.g. "/admin/videos?type=short"),
  // so Videos and Shorts — which share the same page and are only told
  // apart by ?type= — never both light up (or both stay dark) at once.
  const query = searchParams.toString();
  const currentPath = query ? `${pathname}?${query}` : pathname;

  return (
    <aside className="hidden lg:block w-[280px] shrink-0">
      <div className="sticky top-28 rounded-[28px] border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] p-3 backdrop-blur-xl">
        {items.map((item) => {
          const Icon = item.icon;
          const selected = item.href.includes("?")
            ? currentPath === item.href
            : pathname === item.href && !query;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`mb-2 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors duration-150 ${
                selected
                  ? "border-indigo-400/30 bg-gradient-to-r from-indigo-500/20 to-violet-400/10 light:from-indigo-500/15 light:to-violet-400/10"
                  : "border-transparent hover:bg-white/5 light:hover:bg-black/5"
              }`}
            >
              <Icon
                size={20}
                className={selected ? "text-indigo-300 light:text-indigo-700" : "text-slate-400 light:text-slate-600"}
              />
              <span
                className={
                  selected
                    ? "font-bold text-white light:text-slate-900"
                    : "font-medium text-slate-300 light:text-slate-700"
                }
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
