"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useState } from "react";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Bot,
  MessageSquare,
  Mail,
  Upload,
  ShoppingBag,
  Save,
} from "lucide-react";
import { useAdminMode } from "@/app/components/admin/AdminModeContext";


interface InplayerModerationData {
  domain: "inplayer";
  settings: {
    moderationEnabledComments: boolean;
    moderationEnabledMessages: boolean;
    moderationEnabledUploads: boolean;
  };
  counts: {
    comments: number;
    messages: number;
    uploads: number;
  };
  categories: Record<string, number>;
}

interface HammartModerationData {
  domain: "hammart";
  settings: {
    hammartModerationEnabledListings: boolean;
  };
  counts: {
    listings: number;
  };
  categories: Record<string, number>;
}

// A plain two-button On/Off switch — deliberately not a sliding pill toggle.
// Each state is its own solid, fully-opaque button (no low-opacity overlay
// colors that can wash out against a light background), so which one is
// active is never ambiguous in either theme.
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-shrink-0 overflow-hidden rounded-full border border-white/10 light:border-black/10">
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(true)}
        className={`px-3.5 py-1.5 text-xs font-black transition-colors ${
          checked
            ? "bg-emerald-500 text-white"
            : "bg-white/5 light:bg-black/5 text-slate-400 light:text-slate-600 hover:bg-white/10 light:hover:bg-black/10"
        }`}
      >
        On
      </button>
      <button
        type="button"
        aria-pressed={!checked}
        onClick={() => onChange(false)}
        className={`px-3.5 py-1.5 text-xs font-black transition-colors ${
          !checked
            ? "bg-red-500 text-white"
            : "bg-white/5 light:bg-black/5 text-slate-400 light:text-slate-600 hover:bg-white/10 light:hover:bg-black/10"
        }`}
      >
        Off
      </button>
    </div>
  );
}

function CountCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof MessageSquare;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
      <div className="flex items-center gap-2 text-slate-400 light:text-slate-600">
        <Icon size={15} />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-black text-white light:text-slate-900">
        {value.toLocaleString("en-IN")}
      </p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

// AI Moderation used to only ever cover InPlayer's three content-type
// toggles. Reno's explicit instruction was that AI Moderation should work
// "individually for each of those panels" — Hammart's separate banned-item
// listing check (app/lib/hammartModeration.ts's checkBannedProduct(),
// alcohol/tobacco/weapons/etc.) already existed and already ran on every
// listing, it just had no on/off switch and no page anywhere to see what
// it had flagged. This page now branches on the current admin panel
// (useAdminMode()) — InPlayer keeps its original three-toggle view,
// Hammart gets its own single toggle + flagged-listings view, and each
// saves to its own field (moderationEnabled* vs
// hammartModerationEnabledListings) so neither can affect the other.
// Sponsorship has no user-generated content that runs through either
// pipeline, so it isn't given a (fake) toggle here — this page isn't
// reachable from the Sponsorship panel's sidebar at all.
export default function AiModerationPage() {
  const { mode } = useAdminMode();
  const isHammart = mode === "hammart";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [inplayerData, setInplayerData] = useState<InplayerModerationData | null>(null);
  const [inplayerToggles, setInplayerToggles] = useState<InplayerModerationData["settings"] | null>(null);
  const [hammartData, setHammartData] = useState<HammartModerationData | null>(null);
  const [hammartEnabled, setHammartEnabled] = useState<boolean | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/ai-moderation${isHammart ? "?domain=hammart" : ""}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Couldn't load moderation data (HTTP ${res.status}).`);
      if (isHammart) {
        setHammartData(json as HammartModerationData);
        setHammartEnabled(json.settings.hammartModerationEnabledListings);
      } else {
        setInplayerData(json as InplayerModerationData);
        setInplayerToggles(json.settings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const saveInplayer = async () => {
    if (!inplayerToggles || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await authedFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inplayerToggles),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Couldn't save (HTTP ${res.status}).`);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const toggleHammart = async (v: boolean) => {
    if (saving) return;
    setHammartEnabled(v);
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await authedFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hammartModerationEnabledListings: v }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Couldn't save (HTTP ${res.status}).`);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (isHammart) {
    if (!hammartData || hammartEnabled === null) {
      return (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-700">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error || "Couldn't load AI Moderation."}</span>
        </div>
      );
    }

    const topCategories = Object.entries(hammartData.categories).sort((a, b) => b[1] - a[1]);

    return (
      <div>
        <div>
          <h2 className="text-xl font-black text-white light:text-slate-900">Hammart AI Moderation</h2>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
            Real, automatic banned-item scanning for every Hammart listing (alcohol, tobacco,
            weapons, adult items, and more) — completely independent from InPlayer&apos;s own
            comment/message/upload moderation. A flagged listing is created but hidden from the
            public storefront immediately.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:max-w-xs">
          <CountCard
            icon={ShoppingBag}
            label="Flagged listings"
            value={hammartData.counts.listings}
            hint="Hidden from the public storefront until reviewed"
          />
        </div>

        {topCategories.length > 0 && (
          <div className="mt-4 rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
            <h3 className="text-sm font-bold text-white light:text-slate-900">
              Flagged by category
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {topCategories.map(([cat, n]) => (
                <span
                  key={cat}
                  className="rounded-full bg-white/5 light:bg-black/5 px-3 py-1.5 text-xs font-semibold text-slate-300 light:text-slate-700"
                >
                  {cat} · {n}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 max-w-2xl">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4">
            <div className="flex items-center gap-3">
              <ShoppingBag size={16} className="text-indigo-300" />
              <div>
                <span className="text-sm font-semibold text-white light:text-slate-900">
                  Product listings
                </span>
                <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                  Turn off to skip the OpenAI check entirely — new listings publish immediately,
                  unchecked.
                </p>
              </div>
            </div>
            <Toggle checked={hammartEnabled} onChange={toggleHammart} />
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {saved && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 light:text-emerald-700">
              <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
              <span>Saved — changes are already live.</span>
            </div>
          )}
        </div>

        <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-500">
          <Bot size={12} /> Moderation fails open — if OpenAI is unreachable or the API key is
          missing, listings publish unflagged rather than getting stuck or blocked.
        </p>
      </div>
    );
  }

  if (!inplayerData || !inplayerToggles) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-700">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <span>{error || "Couldn't load AI Moderation."}</span>
      </div>
    );
  }

  const topCategories = Object.entries(inplayerData.categories).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">InPlayer AI Moderation</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Real, automatic scanning via OpenAI&apos;s Moderation API — every comment, direct message,
          and video/Short title+description is checked the instant it&apos;s posted. Flagged content
          is hidden immediately and queued here. Completely independent from Hammart&apos;s own
          banned-item listing check.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CountCard
          icon={MessageSquare}
          label="Flagged comments"
          value={inplayerData.counts.comments}
          hint="Hidden from everyone until reviewed"
        />
        <CountCard
          icon={Mail}
          label="Flagged messages"
          value={inplayerData.counts.messages}
          hint="Never shown to the recipient"
        />
        <CountCard
          icon={Upload}
          label="Flagged uploads"
          value={inplayerData.counts.uploads}
          hint="Hidden from public listings"
        />
      </div>

      {topCategories.length > 0 && (
        <div className="mt-4 rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <h3 className="text-sm font-bold text-white light:text-slate-900">
            Flagged by category
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {topCategories.map(([cat, n]) => (
              <span
                key={cat}
                className="rounded-full bg-white/5 light:bg-black/5 px-3 py-1.5 text-xs font-semibold text-slate-300 light:text-slate-700"
              >
                {cat} · {n}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-bold text-white light:text-slate-900">
          Where auto-moderation runs
        </h3>
        <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
          Turn off any of these to skip the OpenAI check entirely for that content type — content
          posts immediately, unchecked, exactly like before this system existed.
        </p>

        <div className="mt-4 max-w-2xl space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4">
            <div className="flex items-center gap-3">
              <MessageSquare size={16} className="text-indigo-300" />
              <span className="text-sm font-semibold text-white light:text-slate-900">
                Comments
              </span>
            </div>
            <Toggle
              checked={inplayerToggles.moderationEnabledComments}
              onChange={(v) => {
                setInplayerToggles({ ...inplayerToggles, moderationEnabledComments: v });
                setSaved(false);
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4">
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-indigo-300" />
              <span className="text-sm font-semibold text-white light:text-slate-900">
                Direct messages
              </span>
            </div>
            <Toggle
              checked={inplayerToggles.moderationEnabledMessages}
              onChange={(v) => {
                setInplayerToggles({ ...inplayerToggles, moderationEnabledMessages: v });
                setSaved(false);
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4">
            <div className="flex items-center gap-3">
              <Upload size={16} className="text-indigo-300" />
              <span className="text-sm font-semibold text-white light:text-slate-900">
                Video/Short uploads
              </span>
            </div>
            <Toggle
              checked={inplayerToggles.moderationEnabledUploads}
              onChange={(v) => {
                setInplayerToggles({ ...inplayerToggles, moderationEnabledUploads: v });
                setSaved(false);
              }}
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {saved && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 light:text-emerald-700">
            <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
            <span>Saved — changes are already live.</span>
          </div>
        )}

        <button
          type="button"
          onClick={saveInplayer}
          disabled={saving}
          className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(139,92,246,.25)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save changes
        </button>
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-500">
        <Bot size={12} /> Moderation fails open — if OpenAI is unreachable or the API key is
        missing, content posts unflagged rather than getting stuck or blocked.
      </p>
    </div>
  );
}
