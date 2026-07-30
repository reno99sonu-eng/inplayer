"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// Same section list as AdminSidebar, condensed into a horizontally
// scrollable strip for phones (that sidebar is `hidden lg:block`). Kept as
// a separate small list here (not imported from AdminSidebar) since this
// only needs id/label/href, not icons. Every section is real and live as
// of this list (no more `href: null` placeholders) — keep in sync with
// AdminSidebar.tsx's own items array when a section's route changes.
const items = [
  { id: "dashboard", label: "Dashboard", href: "/admin/dashboard" },
  { id: "users", label: "Users", href: "/admin/users" },
  { id: "creators", label: "Creators", href: "/admin/creators" },
  { id: "videos", label: "Videos", href: "/admin/videos" },
  { id: "shorts", label: "Shorts", href: "/admin/videos?type=short" },
  { id: "reports", label: "Reports", href: "/admin/moderation" },
  { id: "copyright", label: "Copyright", href: "/admin/copyright" },
  { id: "revenue", label: "Revenue", href: "/admin/revenue" },
  { id: "ads", label: "Advertising", href: "/admin/advertising" },
  { id: "analytics", label: "Analytics", href: "/admin/analytics" },
  { id: "ai-moderation", label: "AI Moderation", href: "/admin/ai-moderation" },
  { id: "notifications", label: "Notifications", href: "/admin/notifications" },
  { id: "settings", label: "Settings", href: "/admin/settings" },
  { id: "audit-logs", label: "Audit Logs", href: "/admin/audit-logs" },
  { id: "captions", label: "Maintenance", href: "/admin/captions" },
] as const;

export default function AdminMobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const currentPath = query ? `${pathname}?${query}` : pathname;

  return (
    <div className="lg:hidden mb-6 overflow-hidden">
      <div
        className="
          overflow-x-auto
          overflow-y-hidden
          touch-pan-x
          overscroll-x-contain
          pb-6
          -mb-6
          [-ms-overflow-style:none]
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        <div className="flex min-w-max gap-2 px-1 pb-1">
          {items.map((item) => {
            const selected = item.href.includes("?")
              ? currentPath === item.href
              : pathname === item.href && !query;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                  selected
                    ? "bg-gradient-to-r from-indigo-500 to-violet-400 text-white shadow-lg shadow-indigo-500/20"
                    : "bg-white/[0.04] light:bg-black/[0.04] text-slate-300 light:text-slate-700 hover:bg-white/[0.08] light:hover:bg-black/[0.08]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
