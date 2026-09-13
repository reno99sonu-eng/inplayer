"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Shield, Users, DollarSign, ShoppingBag, Trash2 } from "lucide-react";

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Service", icon: FileText },
  { href: "/privacy", label: "Privacy Policy", icon: Shield },
  { href: "/copyright", label: "Copyright Policy", icon: FileText },
  { href: "/child-safety", label: "Child Safety Policy", icon: Shield },
  { href: "/community-guidelines", label: "Community Guidelines", icon: Users },
  { href: "/creator-monetization", label: "Creator Monetization", icon: DollarSign },
  { href: "/hammart-vendor-terms", label: "Vendor Terms", icon: ShoppingBag },
  { href: "/delete-account", label: "Delete Account", icon: Trash2 },
];

export default function LegalNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Legal documents navigation" className="mb-6 overflow-x-auto pb-2 scrollbar-none">
      <div className="flex items-center gap-1.5 min-w-max border-b border-white/10 pb-3 light:border-slate-200">
        {LEGAL_LINKS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-[#FF7A18] to-[#FF9A00] text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5 light:text-slate-600 light:hover:text-slate-900 light:hover:bg-black/5"
              }`}
            >
              <Icon size={14} className={isActive ? "text-white" : "opacity-70"} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
