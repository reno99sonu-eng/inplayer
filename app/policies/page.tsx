"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Shield, FileText, Store } from "lucide-react";
import LegalBackButton from "../components/LegalBackButton";
import PrivacyPolicySection, {
  PRIVACY_LAST_UPDATED,
} from "../components/policies/sections/PrivacyPolicySection";
import TermsSection, { TERMS_LAST_UPDATED } from "../components/policies/sections/TermsSection";
import VendorTermsSection, {
  VENDOR_TERMS_LAST_UPDATED,
} from "../components/policies/sections/VendorTermsSection";

// The single "InPlayer Policies" hub — replaces three separate pages
// (/privacy, /terms, /hammart-vendor-terms), which are now thin redirects
// into this page with the right tab preselected, so every existing link
// (signup consent, HamMart vendor KYC, sitemap, old bookmarks) keeps
// working. Same ?tab= query-param pattern as app/settings/page.tsx, so
// this doesn't invent a new navigation convention.
type PolicyTab = "privacy" | "terms" | "vendor-terms";

const VALID_TABS: PolicyTab[] = ["privacy", "terms", "vendor-terms"];

const TABS: { id: PolicyTab; label: string; shortLabel: string; icon: typeof Shield; lastUpdated: string }[] = [
  { id: "privacy", label: "Privacy Policy", shortLabel: "Privacy", icon: Shield, lastUpdated: PRIVACY_LAST_UPDATED },
  { id: "terms", label: "Terms of Service", shortLabel: "Terms", icon: FileText, lastUpdated: TERMS_LAST_UPDATED },
  {
    id: "vendor-terms",
    label: "HamMart Vendor Terms",
    shortLabel: "Vendor Terms",
    icon: Store,
    lastUpdated: VENDOR_TERMS_LAST_UPDATED,
  },
];

function PoliciesContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [active, setActive] = useState<PolicyTab>(() =>
    tabParam && VALID_TABS.includes(tabParam as PolicyTab) ? (tabParam as PolicyTab) : "privacy"
  );

  useEffect(() => {
    // Deferred rather than called synchronously in the effect body — same
    // pattern as app/components/NavbarSearch.tsx and InFamilyHome.tsx.
    if (!tabParam || !VALID_TABS.includes(tabParam as PolicyTab)) return;
    const timer = setTimeout(() => setActive(tabParam as PolicyTab), 0);
    return () => clearTimeout(timer);
  }, [tabParam]);

  const current = TABS.find((t) => t.id === active) ?? TABS[0];

  return (
    <div className="mx-auto max-w-[900px] px-5 py-10 sm:py-14">
      <LegalBackButton />

      <h1 className="mt-6 text-3xl font-black text-white light:text-slate-900">
        InPlayer Policies
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Privacy, Terms of Service, and HamMart Vendor Terms — all in one place.
      </p>

      {/* Mobile tab strip */}
      <div className="mt-6 overflow-hidden lg:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-all ${
                active === tab.id
                  ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-500/20"
                  : "bg-white/[0.04] light:bg-black/[0.04] text-slate-300 light:text-slate-700 hover:bg-white/[0.08] light:hover:bg-black/[0.08]"
              }`}
            >
              {tab.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 lg:flex lg:items-start lg:gap-10">
        {/* Desktop sidebar */}
        <aside className="hidden w-[220px] shrink-0 lg:block">
          <div className="sticky top-10 rounded-[24px] border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] p-2 backdrop-blur-xl">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const selected = active === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActive(tab.id)}
                  className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-all duration-300 ${
                    selected
                      ? "bg-gradient-to-r from-orange-500/20 to-amber-400/10 border border-orange-400/30"
                      : "hover:bg-white/5 light:hover:bg-black/5 border border-transparent"
                  }`}
                >
                  <Icon size={17} className={selected ? "text-orange-300" : "text-slate-400 light:text-slate-600"} />
                  <span
                    className={`text-sm ${
                      selected ? "font-bold text-white light:text-slate-900" : "font-medium text-slate-300 light:text-slate-700"
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="flex items-center justify-between border-b border-white/10 light:border-black/10 pb-3">
            <h2 className="text-xl font-black text-white light:text-slate-900">{current.label}</h2>
            <p className="text-xs text-slate-500">Last updated: {current.lastUpdated}</p>
          </div>

          {active === "privacy" && <PrivacyPolicySection />}
          {active === "terms" && <TermsSection />}
          {active === "vendor-terms" && <VendorTermsSection />}
        </main>
      </div>
    </div>
  );
}

export default function PoliciesPage() {
  return (
    <Suspense
      fallback={<div className="p-10 text-center text-sm text-slate-500">Loading policies...</div>}
    >
      <PoliciesContent />
    </Suspense>
  );
}
