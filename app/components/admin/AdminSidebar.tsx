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
  BarChart3,
  Bot,
  Bell,
  Settings,
  ScrollText,
  Wrench,
} from "lucide-react";

// One entry per Admin Panel section — every section is real and live as
// of this list (no more `href: null` placeholders). If a future section
// needs to ship in stages again, add `href: string | null` back to this
// array's type and restore the disabled/"Soon" branch below.
const items = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/admin/dashboard" },
  { id: "users", label: "Users", icon: Users, href: "/admin/users" },
  { id: "creators", label: "Creators", icon: Star, href: "/admin/creators" },
  { id: "videos", label: "Videos", icon: Video, href: "/admin/videos" },
  { id: "shorts", label: "Shorts", icon: Film, href: "/admin/videos?type=short" },
  { id: "reports", label: "Reports & Moderation", icon: Flag, href: "/admin/moderation" },
  { id: "copyright", label: "Copyright Center", icon: Copyright, href: "/admin/copyright" },
  { id: "revenue", label: "Revenue", icon: DollarSign, href: "/admin/revenue" },
  { id: "ads", label: "Advertising", icon: Megaphone, href: "/admin/advertising" },
  { id: "analytics", label: "Analytics", icon: BarChart3, href: "/admin/analytics" },
  { id: "ai-moderation", label: "AI Moderation", icon: Bot, href: "/admin/ai-moderation" },
  { id: "notifications", label: "Notifications", icon: Bell, href: "/admin/notifications" },
  { id: "settings", label: "Platform Settings", icon: Settings, href: "/admin/settings" },
  { id: "audit-logs", label: "Audit Logs", icon: ScrollText, href: "/admin/audit-logs" },
  { id: "captions", label: "Maintenance", icon: Wrench, href: "/admin/captions" },
] as const;

export default function AdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
              className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all duration-300 ${
                selected
                  ? "border border-orange-400/30 bg-gradient-to-r from-orange-500/20 to-amber-400/10"
                  : "hover:bg-white/5 light:hover:bg-black/5"
              }`}
            >
              <Icon
                size={20}
                className={selected ? "text-orange-300" : "text-slate-400 light:text-slate-600"}
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
