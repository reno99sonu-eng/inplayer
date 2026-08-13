"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAdminMode } from "@/app/components/admin/AdminModeContext";

// Same three section lists as AdminSidebar (see that file's comment),
// condensed into a horizontally scrollable strip for phones (that sidebar
// is `hidden lg:block`). Kept as separate small lists here (not imported
// from AdminSidebar) since this only needs id/label/href, not icons —
// keep all three in sync with AdminSidebar.tsx's own arrays when a
// section's route changes. (Fixed while adding the Sponsorship mode: this
// list was previously missing the "Orders" hammart page and the
// "Sponsorships" inplayer page that AdminSidebar already had — both real
// gaps, now closed.)
const inplayerItems = [
  { id: "dashboard", label: "Dashboard", href: "/admin/dashboard" },
  { id: "users", label: "Users", href: "/admin/users" },
  { id: "creators", label: "Creators", href: "/admin/creators" },
  { id: "bug-reports", label: "Bug Reports", href: "/admin/bug-reports" },
  { id: "error-logs", label: "Error Logs", href: "/admin/error-logs" },
  { id: "videos", label: "Videos", href: "/admin/videos" },
  { id: "shorts", label: "Shorts", href: "/admin/videos?type=short" },
  { id: "reports", label: "Reports", href: "/admin/moderation" },
  { id: "copyright", label: "Copyright", href: "/admin/copyright" },
  { id: "revenue", label: "Revenue", href: "/admin/revenue" },
  { id: "navbar-theme", label: "Navbar Theme", href: "/admin/navbar-theme" },
  { id: "analytics", label: "Analytics", href: "/admin/analytics" },
  { id: "ai-moderation", label: "AI Moderation", href: "/admin/ai-moderation" },
  { id: "notifications", label: "Notifications", href: "/admin/notifications" },
  { id: "settings", label: "Settings", href: "/admin/settings" },
  { id: "audit-logs", label: "Audit Logs", href: "/admin/audit-logs" },
  { id: "captions", label: "Maintenance", href: "/admin/captions" },
] as const;

const hammartItems = [
  { id: "hammart-vendors", label: "Vendors & KYC", href: "/admin/hammart-vendors" },
  { id: "hammart-products", label: "Products", href: "/admin/hammart-products" },
  { id: "hammart-orders", label: "Orders", href: "/admin/hammart-orders" },
  { id: "settings", label: "Settings", href: "/admin/settings" },
  { id: "audit-logs", label: "Audit Logs", href: "/admin/audit-logs" },
] as const;

const sponsorshipItems = [
  { id: "sponsorships", label: "Sponsorships", href: "/admin/sponsorships" },
  { id: "ads", label: "House Ads & AdSense", href: "/admin/advertising" },
  { id: "settings", label: "Settings", href: "/admin/settings" },
  { id: "audit-logs", label: "Audit Logs", href: "/admin/audit-logs" },
] as const;

export default function AdminMobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mode } = useAdminMode();
  const items = mode === "hammart" ? hammartItems : mode === "sponsorship" ? sponsorshipItems : inplayerItems;
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
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors duration-150 ${
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
