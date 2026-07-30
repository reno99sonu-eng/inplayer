"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Bot,
  MessageSquare,
  Mail,
  Upload,
  Save,
} from "lucide-react";

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

interface ModerationData {
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

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
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

export default function AiModerationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [data, setData] = useState<ModerationData | null>(null);
  const [toggles, setToggles] = useState<ModerationData["settings"] | null>(null);

  const load = async () => {
    try {
      const res = await authedFetch("/api/admin/ai-moderation");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Couldn't load moderation data (HTTP ${res.status}).`);
      setData(json);
      setToggles(json.settings);
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
  }, []);

  const save = async () => {
    if (!toggles || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await authedFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toggles),
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

  if (!data || !toggles) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-700">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <span>{error || "Couldn't load AI Moderation."}</span>
      </div>
    );
  }

  const topCategories = Object.entries(data.categories).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">AI Moderation</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Real, automatic scanning via OpenAI&apos;s Moderation API — every comment, direct message,
          and video/Short title+description is checked the instant it&apos;s posted. Flagged content
          is hidden immediately and queued here.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CountCard
          icon={MessageSquare}
          label="Flagged comments"
          value={data.counts.comments}
          hint="Hidden from everyone until reviewed"
        />
        <CountCard
          icon={Mail}
          label="Flagged messages"
          value={data.counts.messages}
          hint="Never shown to the recipient"
        />
        <CountCard
          icon={Upload}
          label="Flagged uploads"
          value={data.counts.uploads}
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
              checked={toggles.moderationEnabledComments}
              onChange={(v) => {
                setToggles({ ...toggles, moderationEnabledComments: v });
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
              checked={toggles.moderationEnabledMessages}
              onChange={(v) => {
                setToggles({ ...toggles, moderationEnabledMessages: v });
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
              checked={toggles.moderationEnabledUploads}
              onChange={(v) => {
                setToggles({ ...toggles, moderationEnabledUploads: v });
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
          onClick={save}
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
