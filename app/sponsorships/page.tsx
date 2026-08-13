"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, Check, Loader2, AlertTriangle, ArrowLeft, Mail, ExternalLink, LayoutList } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";
import { loadRazorpayCheckoutScript, openSponsorshipCheckout, pollSponsorshipPaymentStatus } from "@/app/lib/sponsorshipCheckoutClient";
import type { SponsorshipPackageType } from "@/app/lib/sponsorships";

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

export default function SponsorshipsPage() {
  const { signedIn, authLoading, openSignIn, user } = useAuthModal();

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

  const startCheckout = (pkg: PackageInfo) => {
    if (authLoading) return;
    if (!signedIn) {
      openSignIn();
      return;
    }
    setSelectedPackage(pkg);
    setForm((prev) => ({ ...prev, contactEmail: user?.email || prev.contactEmail, contactName: user?.name || prev.contactName }));
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
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF7A18] via-[#FF9A00] to-[#FFD54A]">
          <Megaphone size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white light:text-slate-900 sm:text-2xl">Sponsor an Ad on InPlayer</h1>
          <p className="text-xs text-slate-400 light:text-slate-600 sm:text-sm">
            Run your ad for {durationDays} days across InPlayer's real ad placements.
          </p>
        </div>
        {signedIn && (
          <Link
            href="/sponsorships/dashboard"
            className="ml-auto flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 light:border-black/10 light:bg-black/5 light:text-slate-700"
          >
            <LayoutList size={14} />
            My Sponsorships
          </Link>
        )}
      </div>

      {view === "pricing" && (
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
                  className={`flex flex-col rounded-2xl border p-5 ${
                    pkg.packageType === "bundle"
                      ? "border-orange-500/40 bg-gradient-to-br from-orange-500/10 to-amber-400/5"
                      : "border-white/10 bg-[#071120] light:border-black/10 light:bg-white"
                  }`}
                >
                  {pkg.packageType === "bundle" && (
                    <span className="mb-2 inline-flex w-fit items-center rounded-full bg-orange-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-orange-300">
                      Everywhere on InPlayer
                    </span>
                  )}
                  <h2 className="text-lg font-black text-white light:text-slate-900">{pkg.label}</h2>
                  <p className="mt-1 text-sm text-slate-400 light:text-slate-600">{pkg.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {pkg.sections.map((s) => (
                      <span key={s} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-300 light:bg-black/5 light:text-slate-700">
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
                    className="mt-4 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5"
                  >
                    Sponsor Now
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-5 text-slate-400 light:border-black/10 light:bg-black/[0.02] light:text-slate-600">
            <p className="font-bold text-slate-300 light:text-slate-700">How it works</p>
            <p className="mt-1">
              1. Pick a package and pay securely — the exact poster ratios/specs for your placement(s) are shown right after payment.
            </p>
            <p className="mt-1">
              2. Email your ad assets (and your website URL) to <strong>inplayerdigital@gmail.com</strong>, mentioning your reference number.
            </p>
            <p className="mt-1">
              3. InPlayer activates your ad — your {durationDays}-day run starts the moment it goes live, and you can track views/clicks
              anytime from <strong>My Sponsorships</strong> once signed in.
            </p>
          </div>
        </div>
      )}

      {view === "checkoutForm" && selectedPackage && (
        <div className="mx-auto max-w-lg">
          <button
            onClick={() => setView("pricing")}
            className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white light:text-slate-600 light:hover:text-slate-900"
          >
            <ArrowLeft size={14} /> Back to packages
          </button>

          <div className="rounded-2xl border border-white/10 bg-[#071120] p-5 light:border-black/10 light:bg-white">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4 light:border-black/10">
              <div>
                <p className="text-sm font-black text-white light:text-slate-900">{selectedPackage.label}</p>
                <p className="text-xs text-slate-400 light:text-slate-600">{durationDays} days</p>
              </div>
              <p className="text-xl font-black text-white light:text-slate-900">₹{selectedPackage.amountInr.toLocaleString("en-IN")}</p>
            </div>

            <div className="space-y-3">
              {([
                ["companyName", "Company / brand name"],
                ["contactName", "Contact person's name"],
                ["contactEmail", "Contact email"],
                ["contactPhone", "Contact phone"],
                ["websiteUrl", "Website URL (where clicks redirect to)"],
                ["legalName", "Legal business name (KYC)"],
                ["panOrGst", "PAN or GST number (KYC)"],
                ["businessAddress", "Business address (KYC)"],
              ] as [keyof FormState, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400 light:text-slate-600">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={form[field]}
                    onChange={(e) => handleFormChange(field, e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#060D18] px-3 py-2 text-sm text-white outline-none focus:border-orange-400/50 light:border-black/10 light:bg-white light:text-slate-900"
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
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {submitting ? "Opening payment…" : `Pay ₹${selectedPackage.amountInr.toLocaleString("en-IN")}`}
            </button>
          </div>
        </div>
      )}

      {view === "processingPayment" && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Loader2 size={32} className="animate-spin text-orange-400" />
          <p className="font-bold text-white light:text-slate-900">Confirming your payment…</p>
          <p className="text-xs text-slate-400 light:text-slate-600">This usually takes a few seconds.</p>
        </div>
      )}

      {view === "paymentFailed" && (
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

      {view === "confirmed" && (
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
                  <p className="mt-1 text-[11px] text-amber-300">{spec.notes}</p>
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

          <Link
            href="/sponsorships/dashboard"
            className="mt-5 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 py-2.5 text-sm font-bold text-white"
          >
            <ExternalLink size={14} /> Go to My Sponsorships
          </Link>
        </div>
      )}
    </div>
  );
}
