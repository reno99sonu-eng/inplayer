import Link from "next/link";
import { FileText, Shield, Users, DollarSign, ShoppingBag, Trash2 } from "lucide-react";
import LegalBackButton from "../components/LegalBackButton";

// The single "InPlayer Policies" entry point — replaces a hamburger/
// footer/settings menu that used to list several separate policy links
// (Privacy, Terms, Vendor Terms, ...) one row each. Rather than duplicating
// each document's actual legal text here (which would mean maintaining it
// in two places), this is a lightweight index linking out to the real
// pages — each of which already cross-links to every other one via
// LegalNav. Keep this list in sync with app/components/LegalNav.tsx.
export const metadata = {
  title: "Privacy Policies",
  description: "Privacy Policy, Terms & Conditions, and every other InPlayer legal document, in one place.",
  alternates: {
    canonical: "https://inplayer.in/policies",
  },
};

const POLICIES = [
  { href: "/terms", label: "Terms of Service", description: "The agreement governing your use of InPlayer.", icon: FileText },
  { href: "/privacy", label: "Privacy Policy", description: "What we collect, why, and your rights over it.", icon: Shield },
  { href: "/copyright", label: "Copyright Policy", description: "How copyright complaints and takedowns work.", icon: FileText },
  { href: "/child-safety", label: "Child Safety Policy", description: "Age estimation, content safeguards, and minors on InPlayer.", icon: Shield },
  { href: "/community-guidelines", label: "Community Guidelines", description: "What is and isn't allowed on InPlayer.", icon: Users },
  { href: "/creator-monetization", label: "Creator Monetization", description: "Eligibility, payouts, and monetization rules for creators.", icon: DollarSign },
  { href: "/hammart-vendor-terms", label: "HamMart Vendor Terms", description: "Terms for vendors selling on HamMart.", icon: ShoppingBag },
  { href: "/delete-account", label: "Delete Account", description: "How to permanently delete your InPlayer account.", icon: Trash2 },
];

export default function PoliciesPage() {
  return (
    <div className="mx-auto max-w-[820px] px-5 py-10 sm:py-14">
      <LegalBackButton />

      <h1 className="mt-6 text-3xl font-black text-white light:text-slate-900">
        Privacy Policies
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-400 light:text-slate-600">
        Every InPlayer legal document, in one place — pick one below. Each page also has quick links
        to every other one at the top.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {POLICIES.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-orange-400/40 hover:bg-white/[0.06] light:border-slate-200 light:bg-white light:hover:border-orange-400/40 light:hover:bg-orange-50/40"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
              <Icon size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-white group-hover:text-orange-300 light:text-slate-900 light:group-hover:text-orange-600">
                {label}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-slate-400 light:text-slate-600">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
