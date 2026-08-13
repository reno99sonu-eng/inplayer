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
  Receipt,
} from "lucide-react";
import { useAdminMode } from "@/app/components/admin/AdminModeContext";

// Three section lists, one per AdminMode (see AdminModeContext + the
// switcher in AdminHeader). Each mode's own items stay out of the other
// two lists — that's the actual "separate, independent admin sections"
// Reno asked for, not just one more flat sidebar row. Advertising (house
// ads + AdSense) moved here from the InPlayer list into Sponsorship's —
// both House/AdSense ads and paid sponsor campaigns feed the exact same
// rendering slots (see app/api/ads/route.ts), so they belong under one
// "Sponsorship" roof even though only one of the two involves an outside
// sponsor paying InPlayer.
const inplayerItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/admin/dashboard" },
  { id: "users", label: "Users", icon: Users, href: "/admin/users" },
  { id: "creators", label: "Creators", icon: Star, href: "/admin/creators" },
  { id: "bug-reports", label: "Bug Reports", icon: Bug, href: "/admin/bug-reports" },
  { id: "error-logs", label: "Error Logs", icon: AlertTriangle, href: "/admin/error-logs" },
  { id: "videos", label: "Videos", icon: Video, href: "/admin/videos" },
  { id: "shorts", label: "Shorts", icon: Film, href: "/admin/videos?type=short" },
  { id: "reports", label: "Reports & Moderation", icon: Flag, href: "/admin/moderation" },
  { id: "copyright", label: "Copyright Center", icon: Copyright, href: "/admin/copyright" },
  { id: "revenue", label: "Revenue", icon: DollarSign, href: "/admin/revenue" },
  { id: "navbar-theme", label: "Navbar Theme", icon: Palette, href: "/admin/navbar-theme" },
  { id: "analytics", label: "Analytics", icon: BarChart3, href: "/admin/analytics" },
  { id: "ai-moderation", label: "AI Moderation", icon: Bot, href: "/admin/ai-moderation" },
  { id: "notifications", label: "Notifications", icon: Bell, href: "/admin/notifications" },
  { id: "settings", label: "Platform Settings", icon: Settings, href: "/admin/settings" },
  { id: "audit-logs", label: "Audit Logs", icon: ScrollText, href: "/admin/audit-logs" },
  { id: "captions", label: "Maintenance", icon: Wrench, href: "/admin/captions" },
] as const;

const hammartItems = [
  { id: "hammart-vendors", label: "Vendors & KYC", icon: Store, href: "/admin/hammart-vendors" },
  { id: "hammart-products", label: "Products", icon: ShoppingBag, href: "/admin/hammart-products" },
  { id: "hammart-orders", label: "Orders", icon: Receipt, href: "/admin/hammart-orders" },
  { id: "settings", label: "Platform Settings", icon: Settings, href: "/admin/settings" },
  { id: "audit-logs", label: "Audit Logs", icon: ScrollText, href: "/admin/audit-logs" },
] as const;

const sponsorshipItems = [
  { id: "sponsorships", label: "Sponsorships", icon: Receipt, href: "/admin/sponsorships" },
  { id: "ads", label: "House Ads & AdSense", icon: Megaphone, href: "/admin/advertising" },
  { id: "settings", label: "Platform Settings", icon: Settings, href: "/admin/settings" },
  { id: "audit-logs", label: "Audit Logs", icon: ScrollText, href: "/admin/audit-logs" },
] as const;

export default function AdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mode } = useAdminMode();
  const items = mode === "hammart" ? hammartItems : mode === "sponsorship" ? sponsorshipItems : inplayerItems;
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
