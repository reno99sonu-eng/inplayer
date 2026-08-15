"use client";

import { useEffect, useState } from "react";
import { Megaphone, Check, Loader2, AlertTriangle, ArrowLeft, Mail, LayoutList, Tag, UserCog } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import { loadRazorpayCheckoutScript, openSponsorshipCheckout, pollSponsorshipPaymentStatus } from "@/app/lib/sponsorshipCheckoutClient";
import type { SponsorshipPackageType } from "@/app/lib/sponsorships";
import SponsorshipDashboardPanel from "@/app/components/sponsorships/SponsorshipDashboardPanel";
import SponsorshipProfilePanel from "@/app/components/sponsorships/SponsorshipProfilePanel";

interface PackageInfo {
  packageType: SponsorshipPackageType;
  label: string;
  sections: string[];
  amountInr: number;
  description: string;
}

interface FormState {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  legalName: string;
  panOrGst: string;
  businessAddress: string;
}

const EMPTY_FORM: FormState = {
  companyName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  websiteUrl: "",
  legalName: "",
  panOrGst: "",
  businessAddress: "",
};

const SECTION_LABELS: Record<string, string> = {
  midroll: "Mid-Roll Video Ad",
  homepage_banner: "Homepage Banner",
  watch_banner: "Watch Page Banner",
};

type ViewState = "pricing" | "checkoutForm" | "processingPayment" | "paymentFailed" | "confirmed";
type PanelTab = "buy" | "dashboard" | "profile";

export default function SponsorshipsPage() {
  const { signedIn, authLoading, openSignIn, user } = useAuthModal();

  const [activeTab, setActiveTab] = useState<PanelTab>("buy");

  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [durationDays, setDurationDays] = useState(7);
  const [loadingPackages, setLoadingPackages] = useState(true);

  const [view, setView] = useState<ViewState>("pricing");
  const [selectedPackage, setSelectedPackage] = useState<PackageInfo | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sponsorshipId, setSponsorshipId] = useState<string | null>(null);
  const [specs, setSpecs] = useState<Record<string, { assetType: string; count: string; ratio: string; notes: string }> | null>(null);

  // A returning sponsor's saved details (see app/lib/sponsorProfiles.ts) —
  // fetched once a real signed-in session exists, then used to prefill the
  // checkout form in startCheckout() below so nobody retypes all 8 fields
  // on a second purchase. Silently absent for a brand-new sponsor (never
  // saved anything yet) or if the profile table isn't set up yet — the
  // form just starts blank/session-prefilled in that case, same as before.
  const [profile, setProfile] = useState<FormState | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/sponsorships/packages");
        const data = await res.json();
        setPackages(data.packages || []);
        setDurationDays(data.durationDays || 7);
      } catch (err) {
        console.error("Failed to load sponsorship packages:", err);
      } finally {
        setLoadingPackages(false);
      }
    })();
  }, []);

  // Dashboard/Profile only make sense for a signed-in sponsor — if the
  // session ends while one of those tabs is open (sign-out, expired token),
  // fall back to the Buy tab instead of leaving the page looking blank.
  useEffect(() => {
    if (!signedIn) setActiveTab("buy");
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    (async () => {
      try {
        const res = await authedFetch("/api/sponsorships/profile");
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.profile) {
          setProfile({
            companyName: data.profile.companyName || "",
            contactName: data.profile.contactName || "",
            contactEmail: data.profile.contactEmail || "",
            contactPhone: data.profile.contactPhone || "",
            websiteUrl: data.profile.websiteUrl || "",
            legalName: data.profile.legalName || "",
            panOrGst: data.profile.panOrGst || "",
            businessAddress: data.profile.businessAddress || "",
          });
        }
      } catch (err) {
        console.error("Failed to load sponsor profile:", err);
      }
    })();
  }, [signedIn]);

  const startCheckout = (pkg: PackageInfo) => {
    if (authLoading) return;
    if (!signedIn) {
      openSignIn();
      return;
    }
    setSelectedPackage(pkg);
    setForm({
      companyName: profile?.companyName || "",
      contactName: profile?.contactName || user?.name || "",
      contactEmail: profile?.contactEmail || user?.email || "",
      contactPhone: profile?.contactPhone || "",
      websiteUrl: profile?.websiteUrl || "",
      legalName: profile?.legalName || "",
      panOrGst: profile?.panOrGst || "",
      businessAddress: profile?.businessAddress || "",
    });
    setError(null);
    setView("checkoutForm");
  };

  const handleFormChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitPayment = async () => {
    if (!selectedPackage) return;
    for (const [field, value] of Object.entries(form)) {
      if (!value.trim()) {
        setError(`Please fill in ${field}.`);
        return;
      }
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await authedFetch("/api/sponsorships/checkout", {
        method: "POST",
        body: JSON.stringify({ packageType: selectedPackage.packageType, ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't start checkout right now.");
        setSubmitting(false);
        return;
      }

      setSponsorshipId(data.sponsorshipId);

      await loadRazorpayCheckoutScript();
      const outcome = await openSponsorshipCheckout({
        razorpayOrderId: data.razorpayOrderId,
        razorpayKeyId: data.razorpayKeyId,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
      });

      if (outcome !== "submitted") {
        setError("Payment was closed before completing — you can try again whenever you're ready.");
        setSubmitting(false);
        return;
      }

      setView("processingPayment");
      const status = await pollSponsorshipPaymentStatus({ authedFetch, sponsorshipId: data.sponsorshipId });

      if (status === "paid") {
        const detailRes = await authedFetch(`/api/sponsorships/${data.sponsorshipId}`);
        const detailData = await detailRes.json().catch(() => ({}));
        setSpecs(detailData.specs || null);
        setView("confirmed");
      } else if (status === "failed") {
        setView("paymentFailed");
      } else {
        // Still pending after the poll window — not an error, the webhook
        // may just be a little slow. The Sponsorship Dashboard will show
        // the real status the moment it lands.
        setView("confirmed");
        setSpecs(null);
      }
    } catch (err) {
      console.error("Sponsorship checkout failed:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] shadow-lg shadow-orange-500/20">
            <Megaphone size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white light:text-slate-900 sm:text-2xl">Sponsor an Ad</h1>
            <p className="text-xs text-slate-400 light:text-slate-600">
              Run your ad for {durationDays} days across InPlayer.
            </p>
          </div>
        </div>

        {signedIn && (
          <div className="inline-flex flex-shrink-0 rounded-full border border-white/10 bg-white/[0.04] p-1 light:border-black/10 light:bg-black/[0.04]">
            <button
              type="button"
              onClick={() => setActiveTab("buy")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                activeTab === "buy"
                  ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-lg shadow-orange-500/20"
                  : "text-slate-400 hover:text-slate-200 light:text-slate-600 light:hover:text-slate-900"
              }`}
            >
              <Tag size={13} /> Buy
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                activeTab === "dashboard"
                  ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-lg shadow-orange-500/20"
                  : "text-slate-400 hover:text-slate-200 light:text-slate-600 light:hover:text-slate-900"
              }`}
            >
              <LayoutList size={13} /> Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                activeTab === "profile"
                  ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-lg shadow-orange-500/20"
                  : "text-slate-400 hover:text-slate-200 light:text-slate-600 light:hover:text-slate-900"
              }`}
            >
              <UserCog size={13} /> Profile
            </button>
          </div>
        )}
      </div>

      {activeTab === "dashboard" && signedIn && <SponsorshipDashboardPanel />}
      {activeTab === "profile" && signedIn && <SponsorshipProfilePanel />}

      {activeTab === "buy" && view === "pricing" && (
        <div>
          {loadingPackages ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <Loader2 size={24} className="animate-spin text-indigo-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {packages.map((pkg) => (
                <div
                  key={pkg.packageType}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${
                    pkg.packageType === "bundle"
                      ? "border-orange-500/40 bg-gradient-to-br from-orange-500/10 to-amber-400/5 hover:border-orange-500/60 hover:shadow-orange-500/20"
                      : "border-white/10 bg-white/5 backdrop-blur-md light:border-black/10 light:bg-black/5 hover:border-white/20 light:hover:border-black/20"
                  }`}
                >
                  <div className="absolute inset-0 -z-10 bg-gradient-to-br from-white/0 to-white/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  {pkg.packageType === "bundle" && (
                    <span className="mb-2 inline-flex w-fit items-center rounded-full bg-orange-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-orange-300 light:text-orange-700">
                      Everywhere on InPlayer
                    </span>
                  )}
                  <h2 className="text-lg font-black text-white light:text-slate-900">{pkg.label}</h2>
                  <p className="mt-1 text-sm text-slate-400 light:text-slate-600">{pkg.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {pkg.sections.map((s) => (
                      <span key={s} className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-slate-200 backdrop-blur-sm light:bg-black/5 light:text-slate-700">
                        {SECTION_LABELS[s] || s}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-white light:text-slate-900">₹{pkg.amountInr.toLocaleString("en-IN")}</span>
                    <span className="text-xs font-semibold text-slate-400 light:text-slate-600">/ {durationDays} days</span>
                  </div>
                  <button
                    onClick={() => startCheckout(pkg)}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all duration-300 hover:scale-[1.02] hover:shadow-orange-500/30 active:scale-95"
                  >
                    Sponsor Now
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition-all duration-300 hover:border-white/20 sm:flex-row sm:items-start light:border-black/10 light:bg-black/5 light:hover:border-black/20">
            <div className="flex-shrink-0 text-sm font-black text-white light:text-slate-900">How it works</div>
            <div className="flex flex-col gap-3 text-xs leading-5 text-slate-400 light:text-slate-600 sm:flex-row sm:gap-6">
              <p className="flex-1"><strong className="text-white light:text-slate-900">1. Pay securely</strong> — The exact poster ratios and specs are shown right after payment.</p>
              <p className="flex-1"><strong className="text-white light:text-slate-900">2. Email assets</strong> — Send your assets and URL to <strong>inplayerdigital@gmail.com</strong> with your reference ID.</p>
              <p className="flex-1"><strong className="text-white light:text-slate-900">3. Go live</strong> — Your {durationDays}-day run starts when live. Track it in your Dashboard.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "buy" && view === "checkoutForm" && selectedPackage && (
        <div className="mx-auto max-w-2xl">
          <button
            onClick={() => setView("pricing")}
            className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:-translate-x-1 hover:text-white light:text-slate-600 light:hover:text-slate-900"
          >
            <ArrowLeft size={14} /> Back to packages
          </button>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md shadow-2xl light:border-black/10 light:bg-white">
            <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4 light:border-black/10">
              <div>
                <p className="text-base font-black text-white light:text-slate-900">{selectedPackage.label}</p>
                <p className="text-xs font-medium text-slate-400 light:text-slate-600">{durationDays} days campaign</p>
              </div>
              <p className="text-2xl font-black text-white light:text-slate-900">₹{selectedPackage.amountInr.toLocaleString("en-IN")}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {([
                ["companyName", "Company / brand name"],
                ["contactName", "Contact person's name"],
                ["contactEmail", "Contact email"],
                ["contactPhone", "Contact phone"],
                ["websiteUrl", "Website URL"],
                ["legalName", "Legal business name (KYC)"],
                ["panOrGst", "PAN or GST number (KYC)"],
                ["businessAddress", "Business address (KYC)"],
              ] as [keyof FormState, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-400 light:text-slate-600">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={form[field]}
                    onChange={(e) => handleFormChange(field, e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#060D18]/50 px-3 py-2.5 text-sm text-white outline-none transition focus:border-orange-400/50 focus:bg-[#060D18] light:border-black/10 light:bg-black/5 light:text-slate-900 light:focus:bg-white"
                  />
                </div>
              ))}
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold text-red-300 light:text-red-800">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleSubmitPayment}
              disabled={submitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 py-3.5 text-sm font-black text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-orange-500/30 disabled:opacity-60 active:scale-95"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {submitting ? "Opening payment gateway…" : `Pay ₹${selectedPackage.amountInr.toLocaleString("en-IN")}`}
            </button>
          </div>
        </div>
      )}

      {activeTab === "buy" && view === "processingPayment" && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Loader2 size={32} className="animate-spin text-orange-400" />
          <p className="font-bold text-white light:text-slate-900">Confirming your payment…</p>
          <p className="text-xs text-slate-400 light:text-slate-600">This usually takes a few seconds.</p>
        </div>
      )}

      {activeTab === "buy" && view === "paymentFailed" && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <AlertTriangle size={32} className="text-red-400" />
          <p className="font-bold text-white light:text-slate-900">Payment didn't go through</p>
          <p className="text-xs text-slate-400 light:text-slate-600">No charge was made. You can try again anytime.</p>
          <button
            onClick={() => setView("pricing")}
            className="mt-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white"
          >
            Back to packages
          </button>
        </div>
      )}

      {activeTab === "buy" && view === "confirmed" && (
        <div className="mx-auto max-w-lg rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
          <Check size={32} className="mx-auto mb-2 text-emerald-400" />
          <p className="font-black text-white light:text-slate-900">Payment confirmed!</p>
          <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
            {sponsorshipId ? `Reference: ${sponsorshipId}` : "Your confirmation email is on its way."}
          </p>

          {specs && (
            <div className="mt-5 space-y-3 text-left">
              {Object.entries(specs).map(([section, spec]) => (
                <div key={section} className="rounded-xl border border-white/10 bg-[#071120] p-3 light:border-black/10 light:bg-white">
                  <p className="text-xs font-black text-white light:text-slate-900">{SECTION_LABELS[section] || section}</p>
                  <p className="mt-1 text-[11px] text-slate-400 light:text-slate-600">{spec.assetType} · {spec.count}</p>
                  <p className="text-[11px] text-slate-400 light:text-slate-600">Ratio: {spec.ratio}</p>
                  <p className="mt-1 text-[11px] text-amber-300 light:text-amber-700">{spec.notes}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left text-xs text-slate-300 light:border-black/10 light:bg-black/[0.02] light:text-slate-700">
            <p className="flex items-center gap-1.5 font-bold">
              <Mail size={13} /> Email your assets to activate
            </p>
            <p className="mt-1">
              Send your ad file(s) and website URL to <strong>inplayerdigital@gmail.com</strong>, mentioning reference{" "}
              <strong>{sponsorshipId}</strong>. Your {durationDays}-day run starts the moment it's activated.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 py-2.5 text-sm font-bold text-white"
          >
            <LayoutList size={14} /> Go to My Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
