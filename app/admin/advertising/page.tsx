"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Wand2,
  Sparkles,
  SlidersHorizontal,
  LayoutGrid,
  Video,
} from "lucide-react";
import { compressImageToBanner } from "@/app/lib/imageCompress";
import { generateAiAdData } from "@/app/lib/aiAdGenerator";

type AdSlotSource = "house" | "adsense" | "off";
type Placement = "homepage" | "watch" | "homepage_spotlight" | "weekly_featured";

const PLACEMENT_LABELS: Record<Placement, string> = {
  homepage: "Homepage banner",
  watch: "Watch page banner",
  homepage_spotlight: "Homepage spotlight",
  weekly_featured: "Weekly Featured banner",
};

interface AdSettings {
  adsenseEnabled: boolean;
  adsensePublisherId: string;
  homepageBannerSource: AdSlotSource;
  watchPageBannerSource: AdSlotSource;
  homepageSpotlightSource: AdSlotSource;
  weeklyFeaturedEnabled: boolean;
  midrollEnabled: boolean;
  midrollIntervalSeconds: number;
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

interface MidrollAdCreative {
  adId: string;
  imageUrl: string;
  linkUrl: string;
  title: string;
  active: boolean;
  createdAt: string;
  impressions: number;
  clicks: number;
  skips: number;
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
    <div className="flex items-center gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
            value === o.value
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white/5 text-slate-300 hover:bg-white/10 light:bg-slate-200 light:text-slate-800 light:hover:bg-slate-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const DEFAULT_SETTINGS: AdSettings = {
  adsenseEnabled: false,
  adsensePublisherId: "",
  homepageBannerSource: "house",
  watchPageBannerSource: "house",
  homepageSpotlightSource: "off",
  weeklyFeaturedEnabled: true,
  midrollEnabled: true,
  midrollIntervalSeconds: 900,
};

export default function AdvertisingPage() {
  const [activeTab, setActiveTab] = useState<"settings" | "banners" | "midrolls">("settings");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<AdSettings>(DEFAULT_SETTINGS);

  const [creatives, setCreatives] = useState<AdCreative[]>([]);
  const [creativesLoading, setCreativesLoading] = useState(true);
  const [creativesError, setCreativesError] = useState<string | null>(null);
  const [creativeQuery, setCreativeQuery] = useState("");

  const filteredCreatives = useMemo(() => {
    const q = creativeQuery.trim().toLowerCase();
    if (!q) return creatives;
    return creatives.filter(
      (ad) =>
        (ad.title || "").toLowerCase().includes(q) ||
        (ad.adId || "").toLowerCase().includes(q) ||
        (ad.placement || "").toLowerCase().includes(q)
    );
  }, [creatives, creativeQuery]);

  const [uploadPlacement, setUploadPlacement] = useState<Placement>("homepage");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadLink, setUploadLink] = useState("");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [midrollAds, setMidrollAds] = useState<MidrollAdCreative[]>([]);
  const [midrollLoading, setMidrollLoading] = useState(true);
  const [midrollError, setMidrollError] = useState<string | null>(null);
  const [midrollTitle, setMidrollTitle] = useState("");
  const [midrollLink, setMidrollLink] = useState("");
  const [midrollPreview, setMidrollPreview] = useState<string | null>(null);
  const [midrollUploading, setMidrollUploading] = useState(false);
  const [midrollUploadError, setMidrollUploadError] = useState<string | null>(null);
  const midrollFileInputRef = useRef<HTMLInputElement>(null);

  const loadSettings = async () => {
    try {
      const res = await authedFetch("/api/admin/settings");
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.settings) {
        const s = data.settings;
        setSettings({
          adsenseEnabled: Boolean(s.adsenseEnabled),
          adsensePublisherId: s.adsensePublisherId || "",
          homepageBannerSource: s.homepageBannerSource || "house",
          watchPageBannerSource: s.watchPageBannerSource || "house",
          homepageSpotlightSource: s.homepageSpotlightSource || "off",
          weeklyFeaturedEnabled: s.weeklyFeaturedEnabled !== false,
          midrollEnabled: Boolean(s.midrollEnabled),
          midrollIntervalSeconds: s.midrollIntervalSeconds || 900,
        });
      } else if (!res.ok) {
        setError(data?.error || `Couldn't load settings (HTTP ${res.status}).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong loading settings.");
    } finally {
      setLoading(false);
    }
  };

  const loadCreatives = async () => {
    setCreativesLoading(true);
    try {
      const res = await authedFetch("/api/admin/ads");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCreatives(data.items || []);
      } else {
        setCreativesError(data?.error || `Couldn't load ad creatives (HTTP ${res.status}).`);
      }
    } catch (err) {
      setCreativesError(err instanceof Error ? err.message : "Something went wrong loading ad creatives.");
    } finally {
      setCreativesLoading(false);
    }
  };

  const loadMidrollAds = async () => {
    setMidrollLoading(true);
    try {
      const res = await authedFetch("/api/admin/midroll-ads");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMidrollAds(data.items || []);
      } else {
        setMidrollError(data?.error || `Couldn't load mid-roll creatives (HTTP ${res.status}).`);
      }
    } catch (err) {
      setMidrollError(err instanceof Error ? err.message : "Something went wrong loading mid-roll creatives.");
    } finally {
      setMidrollLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadSettings();
      await loadCreatives();
      await loadMidrollAds();
    })();
  }, []);

  const update = <K extends keyof AdSettings>(key: K, value: AdSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const saveSettings = async () => {
    if (saving) return;
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
      if (file.type.startsWith("video/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (typeof event.target?.result === "string") {
            setUploadPreview(event.target.result);
          }
        };
        reader.readAsDataURL(file);
      } else {
        const compressed = await compressImageToBanner(file);
        setUploadPreview(compressed);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't process that file.");
    }
  };

  const generateAiBannerAd = () => {
    const aiData = generateAiAdData(uploadPlacement);
    setUploadTitle(aiData.title);
    setUploadLink(aiData.linkUrl);
    setUploadPreview(aiData.imageUrl);
  };

  const generateAiMidrollAd = () => {
    const aiData = generateAiAdData("midroll");
    setMidrollTitle(aiData.title);
    setMidrollLink(aiData.linkUrl);
    setMidrollPreview(aiData.imageUrl);
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

  const handleMidrollFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMidrollUploadError(null);
    try {
      const compressed = await compressImageToBanner(file);
      setMidrollPreview(compressed);
    } catch (err) {
      setMidrollUploadError(err instanceof Error ? err.message : "Couldn't process that image.");
    }
  };

  const canUploadMidroll =
    Boolean(midrollPreview) && midrollTitle.trim().length > 0 && /^https?:\/\//.test(midrollLink.trim());

  const submitMidrollAd = async () => {
    if (!canUploadMidroll || midrollUploading) return;
    setMidrollUploading(true);
    setMidrollUploadError(null);
    try {
      const res = await authedFetch("/api/admin/midroll-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: midrollPreview,
          linkUrl: midrollLink.trim(),
          title: midrollTitle.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't create that ad.");
      setMidrollAds((prev) => [data.ad, ...prev]);
      setMidrollPreview(null);
      setMidrollTitle("");
      setMidrollLink("");
      if (midrollFileInputRef.current) midrollFileInputRef.current.value = "";
    } catch (err) {
      setMidrollUploadError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setMidrollUploading(false);
    }
  };

  const toggleMidrollActive = async (ad: MidrollAdCreative) => {
    try {
      const res = await authedFetch(`/api/admin/midroll-ads/${ad.adId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !ad.active }),
      });
      if (res.ok) {
        setMidrollAds((prev) => prev.map((c) => (c.adId === ad.adId ? { ...c, active: !c.active } : c)));
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const deleteMidrollAd = async (ad: MidrollAdCreative) => {
    if (!window.confirm(`Delete "${ad.title}"? This can't be undone.`)) return;
    try {
      const res = await authedFetch(`/api/admin/midroll-ads/${ad.adId}`, { method: "DELETE" });
      if (res.ok) setMidrollAds((prev) => prev.filter((c) => c.adId !== ad.adId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const totalImpressions = useMemo(
    () =>
      creatives.reduce((acc, c) => acc + (c.impressions || 0), 0) +
      midrollAds.reduce((acc, m) => acc + (m.impressions || 0), 0),
    [creatives, midrollAds]
  );

  const totalClicks = useMemo(
    () =>
      creatives.reduce((acc, c) => acc + (c.clicks || 0), 0) +
      midrollAds.reduce((acc, m) => acc + (m.clicks || 0), 0),
    [creatives, midrollAds]
  );

  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Compact Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 light:border-black/10 pb-3">
        <div>
          <h2 className="text-xl font-black text-white light:text-slate-900 flex items-center gap-2">
            Advertising Console
          </h2>
          <p className="text-xs text-slate-400 light:text-slate-600">
            Manage banner placements, weekly featured ads, and video player mid-roll ads.
          </p>
        </div>

        {/* Compact Stat Cards */}
        <div className="flex items-center gap-2 text-xs">
          <div className="rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-1.5 text-center">
            <span className="block text-[10px] uppercase font-bold text-slate-400 light:text-slate-500">Active Ads</span>
            <span className="font-extrabold text-white light:text-slate-900">
              {creatives.filter((c) => c.active).length + midrollAds.filter((m) => m.active).length}
            </span>
          </div>
          <div className="rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-1.5 text-center">
            <span className="block text-[10px] uppercase font-bold text-slate-400 light:text-slate-500">Impressions</span>
            <span className="font-extrabold text-white light:text-slate-900">{totalImpressions.toLocaleString("en-IN")}</span>
          </div>
          <div className="rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-1.5 text-center">
            <span className="block text-[10px] uppercase font-bold text-slate-400 light:text-slate-500">Avg CTR</span>
            <span className="font-extrabold text-indigo-400 light:text-indigo-600">{ctr}%</span>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex items-center gap-1.5 border-b border-white/10 light:border-black/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
            activeTab === "settings"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white/5 text-slate-400 hover:bg-white/10 light:bg-black/5 light:text-slate-700"
          }`}
        >
          <SlidersHorizontal size={13} /> Slot Controls & Specs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("banners")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
            activeTab === "banners"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white/5 text-slate-400 hover:bg-white/10 light:bg-black/5 light:text-slate-700"
          }`}
        >
          <LayoutGrid size={13} /> Banner & Weekly Featured ({creatives.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("midrolls")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
            activeTab === "midrolls"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white/5 text-slate-400 hover:bg-white/10 light:bg-black/5 light:text-slate-700"
          }`}
        >
          <Video size={13} /> Mid-Roll Video Ads ({midrollAds.length})
        </button>
      </div>

      {/* TAB 1: Slot Controls & Specs */}
      {activeTab === "settings" && (
        <div className="max-w-3xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white light:text-slate-900 block">Homepage Banner</span>
                <span className="text-[11px] text-slate-400 light:text-slate-600">Top feed recommendation slot</span>
              </div>
              <SourcePicker
                value={settings.homepageBannerSource}
                onChange={(v) => update("homepageBannerSource", v)}
              />
            </div>

            <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white light:text-slate-900 block">Watch Page Banner</span>
                <span className="text-[11px] text-slate-400 light:text-slate-600">Under video player sidebar</span>
              </div>
              <SourcePicker
                value={settings.watchPageBannerSource}
                onChange={(v) => update("watchPageBannerSource", v)}
              />
            </div>

            <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white light:text-slate-900 block">Homepage Spotlight</span>
                <span className="text-[11px] text-slate-400 light:text-slate-600">Secondary bottom feed ad</span>
              </div>
              <SourcePicker
                value={settings.homepageSpotlightSource}
                onChange={(v) => update("homepageSpotlightSource", v)}
              />
            </div>

            {/* Weekly Featured Banner Toggle */}
            <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white light:text-slate-900 block">Weekly Featured Carousel</span>
                <span className="text-[11px] text-slate-400 light:text-slate-600">Enable/disable hero banner carousel</span>
              </div>
              <button
                type="button"
                onClick={() => update("weeklyFeaturedEnabled", !settings.weeklyFeaturedEnabled)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  settings.weeklyFeaturedEnabled !== false
                    ? "bg-emerald-500/20 text-emerald-300 light:bg-emerald-100 light:text-emerald-800"
                    : "bg-white/5 text-slate-400 light:bg-black/5"
                }`}
              >
                {settings.weeklyFeaturedEnabled !== false ? "On" : "Off"}
              </button>
            </div>
          </div>

          {/* Specifications Card */}
          <div className="rounded-2xl border border-indigo-500/20 light:border-indigo-600/30 bg-indigo-500/10 p-4 text-xs space-y-2">
            <h3 className="font-bold text-sm text-indigo-300 light:text-indigo-950 flex items-center gap-1.5">
              📐 Recommended Ad Poster Specs & Aspect Ratios
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 light:text-slate-800 font-medium text-[11px]">
              <li className="rounded-xl border border-white/5 light:border-black/5 bg-white/5 light:bg-black/5 p-2.5">
                <strong className="block text-white light:text-slate-900 font-bold">Homepage & Watch Banners</strong>
                <code className="inline-block mt-1 rounded bg-orange-500/20 light:bg-orange-100 px-1.5 py-0.5 font-bold text-orange-300 light:text-amber-900">16:5 ratio</code> (1200 × 375 px)
              </li>
              <li className="rounded-xl border border-white/5 light:border-black/5 bg-white/5 light:bg-black/5 p-2.5">
                <strong className="block text-white light:text-slate-900 font-bold">Weekly Featured Banner</strong>
                <code className="inline-block mt-1 rounded bg-orange-500/20 light:bg-orange-100 px-1.5 py-0.5 font-bold text-orange-300 light:text-amber-900">16:5 ratio</code> (1920 × 600 px)
              </li>
              <li className="rounded-xl border border-white/5 light:border-black/5 bg-white/5 light:bg-black/5 p-2.5">
                <strong className="block text-white light:text-slate-900 font-bold">Video Mid-Roll Ads</strong>
                <code className="inline-block mt-1 rounded bg-orange-500/20 light:bg-orange-100 px-1.5 py-0.5 font-bold text-orange-300 light:text-amber-900">16:9 ratio</code> (1920 × 1080 px)
              </li>
              <li className="rounded-xl border border-white/5 light:border-black/5 bg-white/5 light:bg-black/5 p-2.5">
                <strong className="block text-white light:text-slate-900 font-bold">Homepage Spotlight</strong>
                <code className="inline-block mt-1 rounded bg-orange-500/20 light:bg-orange-100 px-1.5 py-0.5 font-bold text-orange-300 light:text-amber-900">16:9 or 4:3</code> (1200 × 675 px)
              </li>
            </ul>
          </div>

          {/* AdSense Settings */}
          <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 space-y-2">
            <h3 className="text-xs font-bold text-white light:text-slate-900">Google AdSense Configuration</h3>
            <input
              type="text"
              value={settings.adsensePublisherId}
              onChange={(e) => {
                update("adsensePublisherId", e.target.value.trim());
                update("adsenseEnabled", e.target.value.trim().length > 0);
              }}
              placeholder="Publisher ID (pub-1234567890123456)"
              className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-1.5 text-xs text-white light:text-slate-900 outline-none focus:border-indigo-400"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-300 light:text-red-700">
              <AlertTriangle size={14} /> <span>{error}</span>
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-300 light:text-emerald-700">
              <CheckCircle2 size={14} /> <span>Saved — live platform settings updated.</span>
            </div>
          )}

          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Settings
          </button>
        </div>
      )}

      {/* TAB 2: Banner & Weekly Featured Creatives */}
      {activeTab === "banners" && (
        <div className="space-y-4">
          {/* Compact Upload & AI Form */}
          <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 light:border-black/10 pb-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(["homepage", "watch", "homepage_spotlight", "weekly_featured"] as Placement[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setUploadPlacement(p)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                      uploadPlacement === p
                        ? "bg-indigo-600 text-white"
                        : "bg-white/5 text-slate-300 light:bg-black/5 light:text-slate-700 hover:bg-white/10"
                    }`}
                  >
                    {PLACEMENT_LABELS[p]}
                  </button>
                ))}
              </div>

              {/* Magic AI Generator Button */}
              <button
                type="button"
                onClick={generateAiBannerAd}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-pink-500 px-3 py-1 text-[11px] font-bold text-white shadow-sm transition hover:opacity-90"
              >
                <Sparkles size={13} /> Magic AI Generate Ad
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 light:text-slate-600 mb-1">Ad Title</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. InPlayer Pro Pass Promo"
                  className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-1.5 text-xs text-white light:text-slate-900 outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 light:text-slate-600 mb-1">Target Link URL</label>
                <input
                  type="text"
                  value={uploadLink}
                  onChange={(e) => setUploadLink(e.target.value)}
                  placeholder="https://inplayer.in/pro"
                  className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-1.5 text-xs text-white light:text-slate-900 outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 light:text-slate-600 mb-1">Upload File (Image/Video)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="block w-full text-[11px] text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-2.5 file:py-1 file:text-[11px] file:font-bold file:text-white hover:file:bg-white/20"
                />
              </div>
            </div>

            {uploadPreview && (
              <div className="relative rounded-xl border border-white/10 light:border-black/10 overflow-hidden bg-black/20 max-h-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadPreview} alt="Preview" className="w-full h-36 object-cover" />
                <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">Preview</span>
              </div>
            )}

            {uploadError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-300 light:text-red-700">
                <AlertTriangle size={14} /> <span>{uploadError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={submitCreative}
              disabled={!canUpload || uploading}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Save & Publish Banner
            </button>
          </div>

          {/* Creatives List */}
          {filteredCreatives.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {filteredCreatives.map((ad) => (
                <div key={ad.adId} className="rounded-xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-2.5 space-y-2">
                  <div className="relative h-24 overflow-hidden rounded-lg border border-white/10 light:border-black/10 bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                    <span className="absolute top-1.5 right-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold text-white uppercase">
                      {PLACEMENT_LABELS[ad.placement] || ad.placement}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <p className="truncate font-bold text-white light:text-slate-900">{ad.title || "Untitled Ad"}</p>
                    <button
                      type="button"
                      onClick={() => toggleActive(ad)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        ad.active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-slate-400"
                      }`}
                    >
                      {ad.active ? "Active" : "Paused"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Imps: {Number(ad.impressions || 0).toLocaleString("en-IN")}</span>
                    <span>Clicks: {Number(ad.clicks || 0).toLocaleString("en-IN")}</span>
                    <button type="button" onClick={() => deleteCreative(ad)} className="text-red-400 hover:text-red-300">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Mid-Roll Video Ads */}
      {activeTab === "midrolls" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 light:border-black/10 pb-2">
              <span className="text-xs font-bold text-white light:text-slate-900">Add Video Player Mid-Roll Ad</span>
              <button
                type="button"
                onClick={generateAiMidrollAd}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-pink-500 px-3 py-1 text-[11px] font-bold text-white shadow-sm transition hover:opacity-90"
              >
                <Wand2 size={13} /> Magic AI Mid-Roll Generator
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 light:text-slate-600 mb-1">Ad Title</label>
                <input
                  type="text"
                  value={midrollTitle}
                  onChange={(e) => setMidrollTitle(e.target.value)}
                  placeholder="e.g. InPlayer Pro Upgrade"
                  className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-1.5 text-xs text-white light:text-slate-900 outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 light:text-slate-600 mb-1">Target Link URL</label>
                <input
                  type="text"
                  value={midrollLink}
                  onChange={(e) => setMidrollLink(e.target.value)}
                  placeholder="https://inplayer.in/pro"
                  className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-1.5 text-xs text-white light:text-slate-900 outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 light:text-slate-600 mb-1">Select Media File</label>
                <input
                  ref={midrollFileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleMidrollFileChange}
                  className="block w-full text-[11px] text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-2.5 file:py-1 file:text-[11px] file:font-bold file:text-white hover:file:bg-white/20"
                />
              </div>
            </div>

            {midrollPreview && (
              <div className="relative rounded-xl border border-white/10 light:border-black/10 overflow-hidden bg-black/20 max-h-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={midrollPreview} alt="Preview" className="w-full h-36 object-cover" />
              </div>
            )}

            {midrollUploadError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-300 light:text-red-700">
                <AlertTriangle size={14} /> <span>{midrollUploadError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={submitMidrollAd}
              disabled={!canUploadMidroll || midrollUploading}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {midrollUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Save Mid-Roll Ad
            </button>
          </div>

          {/* Midroll Ad Cards */}
          {midrollAds.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {midrollAds.map((ad) => (
                <div key={ad.adId} className="rounded-xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-2.5 space-y-2">
                  <div className="relative h-24 overflow-hidden rounded-lg border border-white/10 light:border-black/10 bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <p className="truncate font-bold text-white light:text-slate-900">{ad.title || "Untitled Mid-Roll"}</p>
                    <button
                      type="button"
                      onClick={() => toggleMidrollActive(ad)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        ad.active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-slate-400"
                      }`}
                    >
                      {ad.active ? "Active" : "Paused"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Imps: {Number(ad.impressions || 0).toLocaleString("en-IN")}</span>
                    <span>Clicks: {Number(ad.clicks || 0).toLocaleString("en-IN")}</span>
                    <button type="button" onClick={() => deleteMidrollAd(ad)} className="text-red-400 hover:text-red-300">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
