"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// Same section list as AdminSidebar, condensed into a horizontally
// scrollable strip for phones (that sidebar is `hidden lg:block`). Kept as
// a separate small list here (not imported from AdminSidebar) since this
// only needs id/label/href, not icons.
const items = [
  { id: "dashboard", label: "Dashboard", href: "/admin/dashboard" },
  { id: "users", label: "Users", href: "/admin/users" },
  { id: "creators", label: "Creators", href: null },
  { id: "videos", label: "Videos", href: "/admin/videos" },
  { id: "shorts", label: "Shorts", href: "/admin/videos?type=short" },
  { id: "reports", label: "Reports", href: "/admin/moderation" },
  { id: "copyright", label: "Copyright", href: null },
  { id: "revenue", label: "Revenue", href: null },
  { id: "ads", label: "Advertising", href: null },
  { id: "analytics", label: "Analytics", href: null },
  { id: "ai-moderation", label: "AI Moderation", href: null },
  { id: "notifications", label: "Notifications", href: null },
  { id: "settings", label: "Settings", href: null },
  { id: "audit-logs", label: "Audit Logs", href: null },
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
            const selected = item.href
              ? item.href.includes("?")
                ? currentPath === item.href
                : pathname === item.href && !query
              : false;

            if (!item.href) {
              return (
                <span
                  key={item.id}
                  className="shrink-0 whitespace-nowrap rounded-full bg-white/[0.03] light:bg-black/[0.03] px-4 py-2 text-xs font-semibold text-slate-500 opacity-60"
                >
                  {item.label} · Soon
                </span>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                  selected
                    ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-500/20"
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
