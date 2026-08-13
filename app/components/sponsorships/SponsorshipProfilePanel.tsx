"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, CheckCircle2, AlertTriangle, UserCog } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";

interface ProfileForm {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  legalName: string;
  panOrGst: string;
  businessAddress: string;
}

const EMPTY_FORM: ProfileForm = {
  companyName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  websiteUrl: "",
  legalName: "",
  panOrGst: "",
  businessAddress: "",
};

const FIELDS: [keyof ProfileForm, string][] = [
  ["companyName", "Company / brand name"],
  ["contactName", "Contact person's name"],
  ["contactEmail", "Contact email"],
  ["contactPhone", "Contact phone"],
  ["websiteUrl", "Website URL (where ad clicks redirect to)"],
  ["legalName", "Legal business name (KYC)"],
  ["panOrGst", "PAN or GST number (KYC)"],
  ["businessAddress", "Business address (KYC)"],
];

// A sponsor's own account-level defaults — just the fields the checkout
// form and KYC already ask for, nothing extra. Saving here (or simply
// buying a sponsorship, which auto-saves whatever was typed — see
// app/api/sponsorships/checkout/route.ts) is what prefills every FUTURE
// purchase's checkout form, so a returning sponsor never retypes the same
// 8 fields twice. Deliberately no unrelated "account settings" bloat
// (notifications, theme, etc.) — those already live in the site's own
// Settings, this panel only owns what's actually specific to sponsoring.
export default function SponsorshipProfilePanel() {
  const { signedIn, authLoading, openSignIn } = useAuthModal();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!signedIn) {
      openSignIn();
      return;
    }
    (async () => {
      try {
        const res = await authedFetch("/api/sponsorships/profile");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Couldn't load your profile.");
        if (data.profile) {
          setForm({
            companyName: data.profile.companyName || "",
            contactName: data.profile.contactName || "",
            contactEmail: data.profile.contactEmail || "",
            contactPhone: data.profile.contactPhone || "",
            websiteUrl: data.profile.websiteUrl || "",
            legalName: data.profile.legalName || "",
            panOrGst: data.profile.panOrGst || "",
            businessAddress: data.profile.businessAddress || "",
          });
          setUpdatedAt(data.profile.updatedAt || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, signedIn, openSignIn]);

  const update = (field: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await authedFetch("/api/sponsorships/profile", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save your profile.");
      setUpdatedAt(data.profile?.updatedAt || null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
          <UserCog size={16} className="text-orange-300 light:text-orange-700" />
        </div>
        <p className="text-xs text-slate-400 light:text-slate-600">
          Saved here once, reused to prefill every future sponsorship you buy — you'll never have to
          retype your company/contact/KYC details again.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#071120] p-5 light:border-black/10 light:bg-white">
        <div className="space-y-3">
          {FIELDS.map(([field, label]) => (
            <div key={field}>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400 light:text-slate-600">
                {label}
              </label>
              <input
                type="text"
                value={form[field]}
                onChange={(e) => update(field, e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#060D18] px-3 py-2 text-sm text-white outline-none focus:border-orange-400/50 light:border-black/10 light:bg-white light:text-slate-900"
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold text-red-300 light:text-red-700">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {saved && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300 light:text-emerald-700">
            <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
            <span>Saved.</span>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save changes
          </button>
          {updatedAt && (
            <p className="text-xs text-slate-500">Last saved {new Date(updatedAt).toLocaleString()}</p>
          )}
        </div>
      </div>
    </div>
  );
}
