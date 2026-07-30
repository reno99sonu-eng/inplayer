"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Loader2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  UserPlus,
  Megaphone,
  Bot,
  DollarSign,
} from "lucide-react";
import Link from "next/link";

async function authedFetch(path: string, options: RequestInit = {}) {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) throw new Error("Session expired — please sign in again.");
  return fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${idToken}`,
    },
  });
}

interface CoreSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  signupsEnabled: boolean;
  announcementEnabled: boolean;
  announcementText: string;
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
        checked ? "bg-indigo-500" : "bg-white/10 light:bg-black/10"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<CoreSettings | null>(null);
  const [updatedMeta, setUpdatedMeta] = useState<{ updatedAt: string | null; updatedBy: string | null }>({
    updatedAt: null,
    updatedBy: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await authedFetch("/api/admin/settings");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Couldn't load settings (HTTP ${res.status}).`);
        setSettings({
          maintenanceMode: Boolean(data.settings.maintenanceMode),
          maintenanceMessage: data.settings.maintenanceMessage || "",
          signupsEnabled: data.settings.signupsEnabled !== false,
          announcementEnabled: Boolean(data.settings.announcementEnabled),
          announcementText: data.settings.announcementText || "",
        });
        setUpdatedMeta({ updatedAt: data.settings.updatedAt, updatedBy: data.settings.updatedBy });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = <K extends keyof CoreSettings>(key: K, value: CoreSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  const save = async () => {
    if (!settings || saving) return;

    if (settings.maintenanceMode) {
      const ok = window.confirm(
        "Turning maintenance mode ON will hide the site from every visitor except you. Continue?"
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
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Couldn't save settings (HTTP ${res.status}).`);
      setUpdatedMeta({ updatedAt: data.settings.updatedAt, updatedBy: data.settings.updatedBy });
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

  if (!settings) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-700">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <span>{error || "Couldn't load Platform Settings."}</span>
      </div>
    );
  }

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">Platform Settings</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Real, live site-wide controls — every toggle here takes effect immediately for every
          visitor, no redeploy needed.
        </p>
      </div>

      <div className="mt-5 max-w-2xl space-y-4">
        {/* Maintenance mode */}
        <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10">
                <Wrench size={16} className="text-indigo-300" />
              </div>
              <div>
                <h3 className="font-bold text-white light:text-slate-900">Maintenance mode</h3>
                <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                  Shows every signed-out visitor and non-admin user a &ldquo;Be right back&rdquo; splash
                  instead of the app. Your own admin account always keeps working.
                </p>
              </div>
            </div>
            <Toggle checked={settings.maintenanceMode} onChange={(v) => update("maintenanceMode", v)} />
          </div>
          {settings.maintenanceMode && (
            <div className="mt-4 pl-12">
              <label className="mb-1.5 block text-xs font-semibold text-slate-400 light:text-slate-600">
                Message shown to visitors
              </label>
              <textarea
                value={settings.maintenanceMessage}
                onChange={(e) => update("maintenanceMessage", e.target.value.slice(0, 500))}
                rows={2}
                placeholder="InPlayer is down for scheduled maintenance. We'll be back shortly."
                className="w-full resize-none rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none focus:border-indigo-400/50"
              />
            </div>
          )}
        </div>

        {/* Sign-ups */}
        <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10">
                <UserPlus size={16} className="text-indigo-300" />
              </div>
              <div>
                <h3 className="font-bold text-white light:text-slate-900">New sign-ups</h3>
                <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                  Turn off to pause new account creation — existing users can still sign in
                  normally.
                </p>
              </div>
            </div>
            <Toggle checked={settings.signupsEnabled} onChange={(v) => update("signupsEnabled", v)} />
          </div>
        </div>

        {/* Announcement */}
        <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10">
                <Megaphone size={16} className="text-indigo-300" />
              </div>
              <div>
                <h3 className="font-bold text-white light:text-slate-900">Site-wide announcement</h3>
                <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                  A dismissible banner across the top of every page — e.g. &ldquo;Paid memberships are
                  live&rdquo; or a scheduled-downtime notice.
                </p>
              </div>
            </div>
            <Toggle
              checked={settings.announcementEnabled}
              onChange={(v) => update("announcementEnabled", v)}
            />
          </div>
          {settings.announcementEnabled && (
            <div className="mt-4 pl-12">
              <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-400 light:text-slate-600">
                <span>Banner text</span>
                <span className={settings.announcementText.length > 200 ? "text-red-400" : ""}>
                  {settings.announcementText.length}/200
                </span>
              </label>
              <input
                type="text"
                value={settings.announcementText}
                onChange={(e) => update("announcementText", e.target.value.slice(0, 200))}
                placeholder="e.g. Paid memberships are now live on InPlayer!"
                className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-2 text-sm text-white light:text-slate-900 outline-none focus:border-indigo-400/50"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {saved && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 light:text-emerald-700">
            <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
            <span>Saved — changes are already live for every visitor.</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(139,92,246,.25)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save changes
          </button>
          {updatedMeta.updatedAt && (
            <p className="text-xs text-slate-500">
              Last saved {new Date(updatedMeta.updatedAt).toLocaleString()}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] p-4">
          <p className="mb-3 text-xs font-semibold text-slate-400 light:text-slate-600">
            Related settings live in their own sections:
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/ai-moderation"
              className="flex items-center gap-1.5 rounded-full bg-white/5 light:bg-black/5 px-3 py-1.5 text-xs font-bold text-slate-300 light:text-slate-700 hover:bg-white/10"
            >
              <Bot size={12} /> AI Moderation
            </Link>
            <Link
              href="/admin/advertising"
              className="flex items-center gap-1.5 rounded-full bg-white/5 light:bg-black/5 px-3 py-1.5 text-xs font-bold text-slate-300 light:text-slate-700 hover:bg-white/10"
            >
              <DollarSign size={12} /> Advertising
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
