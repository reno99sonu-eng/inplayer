"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useState } from "react";
import {
  Loader2,
  Save,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Users,
  Eye,
  Shield,
  PieChart
} from "lucide-react";
import { PlatformSettings } from "@/app/lib/platformSettings";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
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

export default function MonetizationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  
  // We explicitly type the subset of settings we care about
  type MonetizationConfig = Pick<PlatformSettings,
    | "monetizationEnabled"
    | "monetizationRequiredSubscribers"
    | "monetizationRequiredVideoViews"
    | "monetizationRequiredShortViews"
    | "monetizationRequireBoth"
    | "monetizationRequireGoodStanding"
    | "monetizationCreatorShare"
    | "monetizationPlatformShare"
  >;
  
  const [settings, setSettings] = useState<MonetizationConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await authedFetch("/api/admin/settings");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Couldn't load settings (HTTP ${res.status}).`);
        if (cancelled) return;
        
        setSettings({
          monetizationEnabled: Boolean(data.settings.monetizationEnabled),
          monetizationRequiredSubscribers: Number(data.settings.monetizationRequiredSubscribers) || 0,
          monetizationRequiredVideoViews: Number(data.settings.monetizationRequiredVideoViews) || 0,
          monetizationRequiredShortViews: Number(data.settings.monetizationRequiredShortViews) || 0,
          monetizationRequireBoth: Boolean(data.settings.monetizationRequireBoth),
          monetizationRequireGoodStanding: Boolean(data.settings.monetizationRequireGoodStanding),
          monetizationCreatorShare: Number(data.settings.monetizationCreatorShare) || 0,
          monetizationPlatformShare: Number(data.settings.monetizationPlatformShare) || 0,
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = <K extends keyof MonetizationConfig>(key: K, value: MonetizationConfig[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  const save = async (override?: MonetizationConfig) => {
    const target = override || settings;
    if (!target || saving) return;

    if (target.monetizationEnabled && !settings?.monetizationEnabled) {
      const ok = window.confirm(
        `Enabling Monetization globally will allow eligible creators to activate monetization and start accruing real revenue. Continue?`
      );
      if (!ok) return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await authedFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Couldn't save settings (HTTP ${res.status}).`);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAndSave = <K extends keyof MonetizationConfig>(key: K, value: MonetizationConfig[K]) => {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaved(false);
    save(next);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-700">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <span>{error || "Couldn't load Platform Settings."}</span>
      </div>
    );
  }

  // Helper for numeric inputs
  const NumberInput = ({ 
    label, 
    value, 
    onChangeKey, 
    min, 
    max,
    step = 1
  }: { 
    label: string, 
    value: number, 
    onChangeKey: keyof MonetizationConfig, 
    min: number, 
    max?: number,
    step?: number
  }) => (
    <div className="mt-4 pl-12 flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-400 light:text-slate-600">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => update(onChangeKey, Number(e.target.value) as never)}
        className="w-full max-w-[200px] rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-2.5 text-sm font-mono text-white light:text-slate-900 outline-none focus:border-indigo-400/50"
      />
    </div>
  );

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">Monetization Configuration</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          The central source of truth for the Monetization Eligibility Engine. 
          Every change to the Revenue Share configuration here is permanently version-logged into DynamoDB 
          to protect historical creator earnings calculations.
        </p>
      </div>

      <div className="mt-5 max-w-2xl space-y-4 pb-20">
        {/* Global Master Switch */}
        <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10">
                <DollarSign size={16} className="text-indigo-300" />
              </div>
              <div>
                <h3 className="font-bold text-white light:text-slate-900">Global Monetization Enabled</h3>
                <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                  Master switch for the entire monetization architecture. Turning this off stops all new
                  creators from activating monetization. Existing creators keep their history.
                </p>
              </div>
            </div>
            <Toggle checked={settings.monetizationEnabled} onChange={(v) => toggleAndSave("monetizationEnabled", v)} />
          </div>
        </div>

        {/* Eligibility Thresholds */}
        <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
                <Users size={16} className="text-orange-400" />
              </div>
              <div>
                <h3 className="font-bold text-white light:text-slate-900">Eligibility Thresholds</h3>
                <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                  The raw numbers a creator must hit before the dashboard unlocks the activation button.
                  These are calculated dynamically against live views/subs in DynamoDB.
                </p>
              </div>
            </div>
          </div>
          
          <NumberInput 
            label="Required Subscribers (In-Family)" 
            value={settings.monetizationRequiredSubscribers} 
            onChangeKey="monetizationRequiredSubscribers" 
            min={0} 
          />
          <NumberInput 
            label="Required Total Video Views" 
            value={settings.monetizationRequiredVideoViews} 
            onChangeKey="monetizationRequiredVideoViews" 
            min={0} 
          />
          <NumberInput 
            label="Required Total Shorts Views" 
            value={settings.monetizationRequiredShortViews} 
            onChangeKey="monetizationRequiredShortViews" 
            min={0} 
          />
        </div>

        {/* Requirements Rules */}
        <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div className="flex flex-col gap-5">
            {/* Require Both */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                  <Eye size={16} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white light:text-slate-900">Require Both (Subs + Views)</h3>
                  <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                    If ON: Creators must meet the subscriber count AND one of the view counts (Video or Shorts).
                    If OFF: Hitting ANY one of the three thresholds makes them eligible.
                  </p>
                </div>
              </div>
              <Toggle checked={settings.monetizationRequireBoth} onChange={(v) => toggleAndSave("monetizationRequireBoth", v)} />
            </div>

            {/* Good Standing */}
            <div className="flex items-start justify-between gap-4 pt-4 border-t border-white/5 light:border-black/5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Shield size={16} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white light:text-slate-900">Require Good Standing</h3>
                  <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                    If ON: Accounts that are currently suspended or temp-banned cannot apply for monetization, 
                    even if they exceed all metric thresholds.
                  </p>
                </div>
              </div>
              <Toggle checked={settings.monetizationRequireGoodStanding} onChange={(v) => toggleAndSave("monetizationRequireGoodStanding", v)} />
            </div>
          </div>
        </div>

        {/* Revenue Splits */}
        <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-purple-500/10">
                <PieChart size={16} className="text-purple-400" />
              </div>
              <div>
                <h3 className="font-bold text-white light:text-slate-900">Revenue Splits</h3>
                <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                  The fixed percentage of total gross revenue distributed. Modifying these values creates a new
                  permanently versioned Config-History record. Must be entered as decimals (e.g. 0.8 = 80%).
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <NumberInput 
              label="Creator Share (e.g. 0.80)" 
              value={settings.monetizationCreatorShare} 
              onChangeKey="monetizationCreatorShare" 
              min={0}
              max={1}
              step={0.01}
            />
            <NumberInput 
              label="Platform Share (e.g. 0.20)" 
              value={settings.monetizationPlatformShare} 
              onChangeKey="monetizationPlatformShare" 
              min={0}
              max={1}
              step={0.01}
            />
          </div>
          {settings.monetizationCreatorShare + settings.monetizationPlatformShare !== 1 && (
            <div className="mt-4 pl-12 text-xs font-bold text-red-500">
              Warning: The splits currently do not sum exactly to 1.0.
            </div>
          )}
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div className="flex items-center gap-3">
            {error ? (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            ) : saved ? (
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 size={16} />
                <span>Changes saved to DynamoDB</span>
              </div>
            ) : (
              <span className="text-sm text-slate-400 light:text-slate-600">
                Unsaved changes to thresholds or splits
              </span>
            )}
          </div>
          <button
            onClick={() => save()}
            disabled={saving || (settings.monetizationCreatorShare + settings.monetizationPlatformShare !== 1)}
            className="flex h-10 items-center gap-2 rounded-xl bg-indigo-500 px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-400 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
