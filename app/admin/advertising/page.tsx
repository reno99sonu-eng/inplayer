"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Save,
  Upload,
  Trash2,
  Eye,
  MousePointerClick,
  ImagePlus,
  Search,
} from "lucide-react";
import { compressImageToBanner } from "@/app/lib/imageCompress";

async function authedFetch(path: string, options: RequestInit = {}) {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) throw new Error("Session expired — please sign in again.");
  return fetch(path, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${idToken}` },
  });
}

type AdSlotSource = "house" | "adsense" | "off";
type Placement = "homepage" | "watch";

interface AdSettings {
  adsenseEnabled: boolean;
  adsensePublisherId: string;
  homepageBannerSource: AdSlotSource;
  watchPageBannerSource: AdSlotSource;
}

interface AdCreative {
  adId: string;
  placement: Placement;
  imageUrl: string;
  linkUrl: string;
  title: string;
  active: boolean;
  createdAt: string;
  impressions: number;
  clicks: number;
}

function SourcePicker({
  value,
  onChange,
}: {
  value: AdSlotSource;
  onChange: (v: AdSlotSource) => void;
}) {
  const options: { value: AdSlotSource; label: string }[] = [
    { value: "off", label: "Off" },
    { value: "house", label: "House ad" },
    { value: "adsense", label: "AdSense" },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
            value === o.value
              ? "bg-indigo-500 text-white"
              : "bg-white/5 text-slate-400 hover:bg-white/10 light:bg-black/5"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function AdvertisingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<AdSettings | null>(null);

  const [creatives, setCreatives] = useState<AdCreative[]>([]);
  const [creativesLoading, setCreativesLoading] = useState(true);
  const [creativesError, setCreativesError] = useState<string | null>(null);
  const [creativeQuery, setCreativeQuery] = useState("");

  const filteredCreatives = useMemo(() => {
    const q = creativeQuery.trim().toLowerCase();
    if (!q) return creatives;
    return creatives.filter(
      (ad) =>
        ad.title.toLowerCase().includes(q) ||
        ad.adId.toLowerCase().includes(q) ||
        ad.placement.toLowerCase().includes(q)
    );
  }, [creatives, creativeQuery]);

  const [uploadPlacement, setUploadPlacement] = useState<Placement>("homepage");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadLink, setUploadLink] = useState("");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSettings = async () => {
    try {
      const res = await authedFetch("/api/admin/settings");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Couldn't load settings (HTTP ${res.status}).`);
      setSettings({
        adsenseEnabled: Boolean(data.settings.adsenseEnabled),
        adsensePublisherId: data.settings.adsensePublisherId || "",
        homepageBannerSource: data.settings.homepageBannerSource || "off",
        watchPageBannerSource: data.settings.watchPageBannerSource || "off",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const loadCreatives = async () => {
    setCreativesLoading(true);
    try {
      const res = await authedFetch("/api/admin/ads");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Couldn't load ad creatives (HTTP ${res.status}).`);
      setCreatives(data.items || []);
    } catch (err) {
      setCreativesError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCreativesLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadSettings();
      await loadCreatives();
    })();
  }, []);

  const update = <K extends keyof AdSettings>(key: K, value: AdSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  const saveSettings = async () => {
    if (!settings || saving) return;
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
      if (!res.ok) throw new Error(data.error || `Couldn't save (HTTP ${res.status}).`);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const compressed = await compressImageToBanner(file);
      setUploadPreview(compressed);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't process that image.");
    }
  };

  const canUpload =
    Boolean(uploadPreview) && uploadTitle.trim().length > 0 && /^https?:\/\//.test(uploadLink.trim());

  const submitCreative = async () => {
    if (!canUpload || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await authedFetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placement: uploadPlacement,
          imageUrl: uploadPreview,
          linkUrl: uploadLink.trim(),
          title: uploadTitle.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't create that ad.");
      setCreatives((prev) => [data.ad, ...prev]);
      setUploadPreview(null);
      setUploadTitle("");
      setUploadLink("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (ad: AdCreative) => {
    try {
      const res = await authedFetch(`/api/admin/ads/${ad.adId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !ad.active }),
      });
      if (res.ok) {
        setCreatives((prev) =>
          prev.map((c) => (c.adId === ad.adId ? { ...c, active: !c.active } : c))
        );
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const deleteCreative = async (ad: AdCreative) => {
    if (!window.confirm(`Delete "${ad.title}"? This can't be undone.`)) return;
    try {
      const res = await authedFetch(`/api/admin/ads/${ad.adId}`, { method: "DELETE" });
      if (res.ok) setCreatives((prev) => prev.filter((c) => c.adId !== ad.adId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
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
        <span>{error || "Couldn't load Advertising."}</span>
      </div>
    );
  }

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">Advertising</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Real ad slots on the homepage and watch page — each can show your own house creative, a
          real Google AdSense unit, or nothing at all.
        </p>
      </div>

      {/* Per-slot source pickers */}
      <div className="mt-5 max-w-2xl space-y-3">
        <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-white light:text-slate-900">
              Homepage banner
            </span>
            <SourcePicker
              value={settings.homepageBannerSource}
              onChange={(v) => update("homepageBannerSource", v)}
            />
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-white light:text-slate-900">
              Watch page banner
            </span>
            <SourcePicker
              value={settings.watchPageBannerSource}
              onChange={(v) => update("watchPageBannerSource", v)}
            />
          </div>
        </div>

        {/* AdSense config */}
        <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white light:text-slate-900">Google AdSense</h3>
              <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                Real AdSense integration — requires your own AdSense publisher account.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-semibold text-slate-400 light:text-slate-600">
              Publisher ID (e.g. pub-1234567890123456)
            </label>
            <input
              type="text"
              value={settings.adsensePublisherId}
              onChange={(e) => {
                update("adsensePublisherId", e.target.value.trim());
                update("adsenseEnabled", e.target.value.trim().length > 0);
              }}
              placeholder="pub-1234567890123456"
              className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-2 text-sm text-white light:text-slate-900 outline-none focus:border-indigo-400/50"
            />
          </div>
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
            <span>Saved — changes are already live.</span>
          </div>
        )}

        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(139,92,246,.25)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save slot settings
        </button>
      </div>

      {/* House ad creatives */}
      <div className="mt-8">
        <h3 className="text-sm font-bold text-white light:text-slate-900">House ad creatives</h3>
        <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
          Upload your own banner image with a link — shown whenever a slot above is set to
          &ldquo;House ad&rdquo;. Multiple active creatives for the same slot rotate randomly.
        </p>

        <div className="mt-4 max-w-2xl rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div className="flex items-center gap-2">
            {(["homepage", "watch"] as Placement[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setUploadPlacement(p)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  uploadPlacement === p
                    ? "bg-indigo-500 text-white"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 light:bg-black/5"
                }`}
              >
                {p === "homepage" ? "Homepage" : "Watch page"}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold text-slate-400 light:text-slate-600">
              Banner image (wide, ~3.2:1)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-white/20"
            />
            {uploadPreview && (
              /* eslint-disable-next-line @next/next/no-img-element -- a
                 freshly compressed in-memory data URL, not a static app
                 asset next/image can optimize. */
              <img
                src={uploadPreview}
                alt="Preview"
                className="mt-3 w-full rounded-xl border border-white/10 light:border-black/10 object-cover"
              />
            )}
          </div>

          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-semibold text-slate-400 light:text-slate-600">
              Title (internal label)
            </label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="e.g. Diwali membership promo"
              className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-2 text-sm text-white light:text-slate-900 outline-none focus:border-indigo-400/50"
            />
          </div>

          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-semibold text-slate-400 light:text-slate-600">
              Link URL
            </label>
            <input
              type="text"
              value={uploadLink}
              onChange={(e) => setUploadLink(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-2 text-sm text-white light:text-slate-900 outline-none focus:border-indigo-400/50"
            />
          </div>

          {uploadError && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={submitCreative}
            disabled={!canUpload || uploading}
            className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(139,92,246,.25)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Add creative
          </button>
        </div>

        {creativesError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-700">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{creativesError}</span>
          </div>
        )}

        {creatives.length > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-4 py-3">
            <Search size={16} className="text-slate-500" />
            <input
              type="text"
              value={creativeQuery}
              onChange={(e) => setCreativeQuery(e.target.value)}
              placeholder="Search by title, ad ID, or placement…"
              className="w-full bg-transparent text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500"
            />
          </div>
        )}

        {creativesLoading ? (
          <div className="flex min-h-[15vh] items-center justify-center">
            <Loader2 size={20} className="animate-spin text-indigo-400" />
          </div>
        ) : creatives.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
            <ImagePlus size={26} className="text-slate-600" />
            <p className="text-sm text-slate-500">No creatives uploaded yet.</p>
          </div>
        ) : filteredCreatives.length === 0 ? (
          <p className="mt-6 text-center text-sm text-slate-500">
            Nothing matches &quot;{creativeQuery}&quot;.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredCreatives.map((ad) => (
              <div
                key={ad.adId}
                className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element --
                    admin-uploaded data URL, not a static app asset. */}
                <img
                  src={ad.imageUrl}
                  alt={ad.title}
                  className="w-full rounded-xl border border-white/10 light:border-black/10 object-cover"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-white light:text-slate-900">
                    {ad.title}
                  </p>
                  <span className="flex-shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-300">
                    {ad.placement}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Eye size={12} /> {ad.impressions.toLocaleString("en-IN")}
                  </span>
                  <span className="flex items-center gap-1">
                    <MousePointerClick size={12} /> {ad.clicks.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(ad)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      ad.active
                        ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                        : "bg-white/5 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    {ad.active ? "Active" : "Paused"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCreative(ad)}
                    className="flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/25"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
