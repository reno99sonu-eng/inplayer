"use client";

import React, { Component, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { authedFetch } from "@/app/lib/apiFetch";
import {
  Loader2,
  AlertTriangle,
  Save,
  Upload,
  Trash2,
  Wand2,
  Sparkles,
  Video,
  Home,
  Tv,
  Star,
  Film,
  Globe,
  Ruler,
  BarChart3,
  X,
  Crop,
  RefreshCw,
} from "lucide-react";
import { compressImageToBanner, aiCropAndRedesignImage, extractVideoFramePoster } from "@/app/lib/imageCompress";
import { generateAiAdData, analyzeImageAndGenerateTitle } from "@/app/lib/aiAdGenerator";

type AdSlotSource = "house" | "adsense" | "off";
type Placement = "homepage" | "watch" | "homepage_spotlight" | "weekly_featured";

type SidePanel =
  | "overview"
  | "homepage"
  | "watch"
  | "weekly_featured"
  | "homepage_spotlight"
  | "midroll"
  | "adsense"
  | "specs";

const PLACEMENT_LABELS: Record<Placement, string> = {
  homepage: "Homepage Banner",
  watch: "Watch Page Banner",
  homepage_spotlight: "Homepage Spotlight",
  weekly_featured: "Weekly Featured Banner",
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

const DEFAULT_SETTINGS: AdSettings = {
  adsenseEnabled: false,
  adsensePublisherId: "",
  homepageBannerSource: "house",
  watchPageBannerSource: "house",
  homepageSpotlightSource: "off",
  weeklyFeaturedEnabled: true, // ON by default
  midrollEnabled: true,
  midrollIntervalSeconds: 900,
};

// In-Page Error Boundary to prevent bubble-up to global Admin Panel Error
interface BoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  hasError: boolean;
  errorMsg: string;
}

class AdvertisingErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return {
      hasError: true,
      errorMsg: error?.message || "An unexpected error occurred while rendering the Advertising Console.",
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Advertising Console Boundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center space-y-3 my-8 max-w-xl mx-auto">
          <div className="flex justify-center">
            <AlertTriangle size={32} className="text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-white light:text-slate-900">Advertising Console Recovery</h3>
          <p className="text-xs text-red-300 light:text-red-700 max-w-md mx-auto">{this.state.errorMsg}</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, errorMsg: "" });
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-500 transition cursor-pointer"
          >
            <RefreshCw size={14} /> Reload Console
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AdvertisingPage() {
  const [activePanel, setActivePanel] = useState<SidePanel>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<AdSettings>(DEFAULT_SETTINGS);

  const [creatives, setCreatives] = useState<AdCreative[]>([]);
  const [midrollAds, setMidrollAds] = useState<MidrollAdCreative[]>([]);

  // Banner Upload Form State
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadLink, setUploadLink] = useState("");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadFileType, setUploadFileType] = useState<"image" | "video" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [croppingAi, setCroppingAi] = useState(false);
  const [generatingTitleAi, setGeneratingTitleAi] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Midroll Upload Form State
  const [midrollTitle, setMidrollTitle] = useState("");
  const [midrollLink, setMidrollLink] = useState("");
  const [midrollPreview, setMidrollPreview] = useState<string | null>(null);
  const [midrollFileType, setMidrollFileType] = useState<"image" | "video" | null>(null);
  const [midrollUploading, setMidrollUploading] = useState(false);
  const [midrollUploadError, setMidrollUploadError] = useState<string | null>(null);
  const [midrollCroppingAi, setMidrollCroppingAi] = useState(false);
  const [midrollGeneratingTitleAi, setMidrollGeneratingTitleAi] = useState(false);
  const midrollFileInputRef = useRef<HTMLInputElement>(null);

  const loadSettings = async () => {
    try {
      const res = await authedFetch("/api/admin/settings");
      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session expired. Please refresh the page to sign back in.");
        } else {
          setError(`Couldn't load settings (HTTP ${res.status}).`);
        }
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.settings && typeof data.settings === "object") {
        const s = data.settings;
        setSettings({
          adsenseEnabled: Boolean(s.adsenseEnabled),
          adsensePublisherId: String(s.adsensePublisherId || ""),
          homepageBannerSource: (s.homepageBannerSource as AdSlotSource) || "house",
          watchPageBannerSource: (s.watchPageBannerSource as AdSlotSource) || "house",
          homepageSpotlightSource: (s.homepageSpotlightSource as AdSlotSource) || "off",
          weeklyFeaturedEnabled: s.weeklyFeaturedEnabled !== false,
          midrollEnabled: Boolean(s.midrollEnabled),
          midrollIntervalSeconds: Number(s.midrollIntervalSeconds) || 900,
        });
      }
    } catch (err) {
      console.error("Advertising settings load error:", err);
      setError(err instanceof Error ? err.message : "Failed to load advertising settings.");
    } finally {
      setLoading(false);
    }
  };

  const loadCreatives = async () => {
    try {
      const res = await authedFetch("/api/admin/ads");
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.items)) {
        const sanitized: AdCreative[] = data.items
          .filter((item: unknown) => item && typeof item === "object" && "adId" in item)
          .map((item: Record<string, unknown>) => ({
            adId: String(item.adId || ""),
            placement: (item.placement as Placement) || "homepage",
            imageUrl: String(item.imageUrl || ""),
            linkUrl: String(item.linkUrl || ""),
            title: String(item.title || ""),
            active: Boolean(item.active),
            createdAt: String(item.createdAt || ""),
            impressions: Number(item.impressions || 0),
            clicks: Number(item.clicks || 0),
          }));
        setCreatives(sanitized);
      }
    } catch (err) {
      console.error("Ad creatives load error:", err);
    }
  };

  const loadMidrollAds = async () => {
    try {
      const res = await authedFetch("/api/admin/midroll-ads");
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.items)) {
        const sanitized: MidrollAdCreative[] = data.items
          .filter((item: unknown) => item && typeof item === "object" && "adId" in item)
          .map((item: Record<string, unknown>) => ({
            adId: String(item.adId || ""),
            imageUrl: String(item.imageUrl || ""),
            linkUrl: String(item.linkUrl || ""),
            title: String(item.title || ""),
            active: Boolean(item.active),
            createdAt: String(item.createdAt || ""),
            impressions: Number(item.impressions || 0),
            clicks: Number(item.clicks || 0),
            skips: Number(item.skips || 0),
          }));
        setMidrollAds(sanitized);
      }
    } catch (err) {
      console.error("Midroll ads load error:", err);
    }
  };

  const reloadAll = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([loadSettings(), loadCreatives(), loadMidrollAds()]);
    setLoading(false);
  };

  useEffect(() => {
    reloadAll();
  }, []);

  const safeCreatives = useMemo(() => (Array.isArray(creatives) ? creatives.filter(Boolean) : []), [creatives]);
  const safeMidrollAds = useMemo(() => (Array.isArray(midrollAds) ? midrollAds.filter(Boolean) : []), [midrollAds]);

  const updateSettings = <K extends keyof AdSettings>(key: K, value: AdSettings[K]) => {
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
      if (!res.ok) throw new Error(data.error || `Couldn't save settings (HTTP ${res.status}).`);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong saving settings.");
    } finally {
      setSaving(false);
    }
  };

  const clearFileSelection = (isMidroll = false) => {
    if (isMidroll) {
      setMidrollPreview(null);
      setMidrollFileType(null);
      if (midrollFileInputRef.current) midrollFileInputRef.current.value = "";
    } else {
      setUploadPreview(null);
      setUploadFileType(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      if (file.type.startsWith("video/")) {
        if (file.size <= 250_000) {
          setUploadFileType("video");
          const reader = new FileReader();
          reader.onload = (event) => {
            if (typeof event.target?.result === "string") {
              setUploadPreview(event.target.result);
            }
          };
          reader.readAsDataURL(file);
        } else {
          setUploadFileType("image");
          const poster = await extractVideoFramePoster(file);
          setUploadPreview(poster);
        }
      } else {
        setUploadFileType("image");
        const compressed = await compressImageToBanner(file);
        setUploadPreview(compressed);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't process that file.");
    }
  };

  const handleMidrollFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMidrollUploadError(null);
    try {
      if (file.type.startsWith("video/")) {
        if (file.size <= 250_000) {
          setMidrollFileType("video");
          const reader = new FileReader();
          reader.onload = (event) => {
            if (typeof event.target?.result === "string") {
              setMidrollPreview(event.target.result);
            }
          };
          reader.readAsDataURL(file);
        } else {
          setMidrollFileType("image");
          const poster = await extractVideoFramePoster(file);
          setMidrollPreview(poster);
        }
      } else {
        setMidrollFileType("image");
        const compressed = await compressImageToBanner(file);
        setMidrollPreview(compressed);
      }
    } catch (err) {
      setMidrollUploadError(err instanceof Error ? err.message : "Couldn't process that file.");
    }
  };

  const generateTitleWithAi = async (targetPlacement: string, isMidroll = false) => {
    if (isMidroll) {
      setMidrollGeneratingTitleAi(true);
      try {
        const res = await analyzeImageAndGenerateTitle(midrollPreview || "", targetPlacement);
        setMidrollTitle(res.title);
        if (!midrollLink) setMidrollLink(res.linkUrl);
      } finally {
        setMidrollGeneratingTitleAi(false);
      }
    } else {
      setGeneratingTitleAi(true);
      try {
        const res = await analyzeImageAndGenerateTitle(uploadPreview || "", targetPlacement);
        setUploadTitle(res.title);
        if (!uploadLink) setUploadLink(res.linkUrl);
      } finally {
        setGeneratingTitleAi(false);
      }
    }
  };

  const handleAiCropAndRedesign = async (placement: Placement) => {
    if (!uploadPreview || uploadFileType === "video") return;
    setCroppingAi(true);
    try {
      const ratio = placement === "weekly_featured" ? 3.2 : placement === "homepage_spotlight" ? 1.77 : 3.2;
      const redesigned = await aiCropAndRedesignImage(uploadPreview, ratio, 1200);
      setUploadPreview(redesigned);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "AI Crop failed.");
    } finally {
      setCroppingAi(false);
    }
  };

  const handleAiCropMidroll = async () => {
    if (!midrollPreview || midrollFileType === "video") return;
    setMidrollCroppingAi(true);
    try {
      const redesigned = await aiCropAndRedesignImage(midrollPreview, 1.77, 1200);
      setMidrollPreview(redesigned);
    } catch (err) {
      setMidrollUploadError(err instanceof Error ? err.message : "AI Crop failed.");
    } finally {
      setMidrollCroppingAi(false);
    }
  };

  const generateMagicAiAd = async (placement: Placement) => {
    if (uploadPreview) {
      await generateTitleWithAi(placement, false);
      await handleAiCropAndRedesign(placement);
    } else {
      const aiData = generateAiAdData(placement);
      setUploadTitle(aiData.title);
      setUploadLink(aiData.linkUrl);
      setUploadPreview(aiData.imageUrl);
      setUploadFileType("image");
    }
  };

  const generateMagicAiMidroll = async () => {
    if (midrollPreview) {
      await generateTitleWithAi("midroll", true);
      await handleAiCropMidroll();
    } else {
      const aiData = generateAiAdData("midroll");
      setMidrollTitle(aiData.title);
      setMidrollLink(aiData.linkUrl);
      setMidrollPreview(aiData.imageUrl);
      setMidrollFileType("image");
    }
  };

  const canUploadBanner =
    Boolean(uploadPreview) && uploadTitle.trim().length > 0 && /^https?:\/\//.test(uploadLink.trim());

  const submitCreative = async (placement: Placement) => {
    if (!canUploadBanner || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await authedFetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placement,
          imageUrl: uploadPreview,
          linkUrl: uploadLink.trim(),
          title: uploadTitle.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't create that ad creative.");
      if (data?.ad) {
        setCreatives((prev) => [data.ad, ...prev]);
      }
      clearFileSelection(false);
      setUploadTitle("");
      setUploadLink("");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
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
      if (!res.ok) throw new Error(data.error || "Couldn't create that ad creative.");
      if (data?.ad) {
        setMidrollAds((prev) => [data.ad, ...prev]);
      }
      clearFileSelection(true);
      setMidrollTitle("");
      setMidrollLink("");
    } catch (err) {
      setMidrollUploadError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setMidrollUploading(false);
    }
  };

  const toggleActive = async (ad: AdCreative) => {
    if (!ad?.adId) return;
    try {
      const res = await authedFetch(`/api/admin/ads/${ad.adId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !ad.active }),
      });
      if (res.ok) {
        setCreatives((prev) => prev.map((c) => (c.adId === ad.adId ? { ...c, active: !c.active } : c)));
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const deleteCreative = async (ad: AdCreative) => {
    if (!ad?.adId) return;
    if (!window.confirm(`Delete "${ad.title || "this ad"}"? This can't be undone.`)) return;
    try {
      const res = await authedFetch(`/api/admin/ads/${ad.adId}`, { method: "DELETE" });
      if (res.ok) setCreatives((prev) => prev.filter((c) => c.adId !== ad.adId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const toggleMidrollActive = async (ad: MidrollAdCreative) => {
    if (!ad?.adId) return;
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
    if (!ad?.adId) return;
    if (!window.confirm(`Delete "${ad.title || "this mid-roll"}"? This can't be undone.`)) return;
    try {
      const res = await authedFetch(`/api/admin/midroll-ads/${ad.adId}`, { method: "DELETE" });
      if (res.ok) setMidrollAds((prev) => prev.filter((c) => c.adId !== ad.adId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const totalImpressions = useMemo(
    () =>
      safeCreatives.reduce((acc, c) => acc + (Number(c.impressions) || 0), 0) +
      safeMidrollAds.reduce((acc, m) => acc + (Number(m.impressions) || 0), 0),
    [safeCreatives, safeMidrollAds]
  );

  const totalClicks = useMemo(
    () =>
      safeCreatives.reduce((acc, c) => acc + (Number(c.clicks) || 0), 0) +
      safeMidrollAds.reduce((acc, m) => acc + (Number(m.clicks) || 0), 0),
    [safeCreatives, safeMidrollAds]
  );

  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0.00";

  const navItems: { id: SidePanel; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: "overview", label: "Overview & Stats", icon: BarChart3 },
    { id: "homepage", label: "Homepage Banner", icon: Home, badge: String(safeCreatives.filter((c) => c.placement === "homepage").length) },
    { id: "watch", label: "Watch Page Banner", icon: Tv, badge: String(safeCreatives.filter((c) => c.placement === "watch").length) },
    { id: "weekly_featured", label: "Weekly Featured Banner", icon: Star, badge: String(safeCreatives.filter((c) => c.placement === "weekly_featured").length) },
    { id: "homepage_spotlight", label: "Homepage Spotlight", icon: Film, badge: String(safeCreatives.filter((c) => c.placement === "homepage_spotlight").length) },
    { id: "midroll", label: "Video Mid-Roll Ads", icon: Video, badge: String(safeMidrollAds.length) },
    { id: "adsense", label: "Google AdSense", icon: Globe },
    { id: "specs", label: "Poster Specs & Ratios", icon: Ruler },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5 min-h-[75vh]">
      {/* LEFT SIDEBAR SUB-NAVIGATION PANEL */}
      <div className="w-full lg:w-64 flex-shrink-0 space-y-1 bg-white/[0.02] light:bg-black/[0.02] border border-white/10 light:border-black/10 rounded-2xl p-2.5 h-fit">
        <div className="px-3 py-2 border-b border-white/10 light:border-black/10 mb-1">
          <h3 className="text-xs font-black text-white light:text-slate-900 uppercase tracking-wider">
            Ad Console Sub-Panels
          </h3>
          <p className="text-[10px] text-slate-400 light:text-slate-600">Select an ad section to manage</p>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActivePanel(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-300 light:text-slate-800 hover:bg-white/5 light:hover:bg-black/5"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon size={15} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    isActive ? "bg-white/20 text-white" : "bg-white/10 light:bg-black/10 text-slate-400 light:text-slate-700"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* RIGHT MAIN PANEL CONTENT AREA */}
      <div className="flex-1 space-y-4">
        {/* Top Header Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 light:border-black/10 pb-3">
          <div>
            <h2 className="text-lg font-black text-white light:text-slate-900 capitalize">
              {navItems.find((n) => n.id === activePanel)?.label}
            </h2>
            <p className="text-xs text-slate-400 light:text-slate-600">
              Manage ad creatives, AI image vision crops, titles, and live status.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-1.5 text-center">
              <span className="block text-[10px] uppercase font-bold text-slate-400 light:text-slate-500">Impressions</span>
              <span className="font-extrabold text-white light:text-slate-900">{totalImpressions.toLocaleString("en-IN")}</span>
            </div>
            <div className="rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-1.5 text-center">
              <span className="block text-[10px] uppercase font-bold text-slate-400 light:text-slate-500">CTR</span>
              <span className="font-extrabold text-indigo-400 light:text-indigo-600">{ctr}%</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} /> <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={reloadAll}
              className="flex items-center gap-1 rounded-lg bg-red-500/20 px-2.5 py-1 text-[11px] font-bold text-red-200 hover:bg-red-500/30 transition cursor-pointer"
            >
              <RefreshCw size={12} /> Reload Section
            </button>
          </div>
        )}

        {/* 1. OVERVIEW & STATS PANEL */}
        {activePanel === "overview" && (
          <div className="space-y-4 max-w-3xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4">
                <span className="text-xs font-bold text-slate-400 light:text-slate-600">Total Active Banner Creatives</span>
                <span className="block text-2xl font-black text-white light:text-slate-900 mt-1">
                  {safeCreatives.filter((c) => c.active).length}
                </span>
              </div>
              <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4">
                <span className="text-xs font-bold text-slate-400 light:text-slate-600">Active Mid-Roll Video Ads</span>
                <span className="block text-2xl font-black text-white light:text-slate-900 mt-1">
                  {safeMidrollAds.filter((m) => m.active).length}
                </span>
              </div>
              <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4">
                <span className="text-xs font-bold text-slate-400 light:text-slate-600">Weekly Featured Carousel</span>
                <span className="block text-sm font-black text-emerald-400 light:text-emerald-700 mt-2">
                  {settings.weeklyFeaturedEnabled ? "ON (Custom Ad Poster)" : "OFF (User Videos Mode - Default)"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 space-y-3">
              <h3 className="text-xs font-bold text-white light:text-slate-900">Current Slot Sources</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between p-2 rounded-xl bg-white/5 light:bg-black/5">
                  <span className="text-slate-400 light:text-slate-700">Homepage Banner:</span>
                  <span className="font-bold text-white light:text-slate-900 uppercase">{settings.homepageBannerSource}</span>
                </div>
                <div className="flex justify-between p-2 rounded-xl bg-white/5 light:bg-black/5">
                  <span className="text-slate-400 light:text-slate-700">Watch Page Banner:</span>
                  <span className="font-bold text-white light:text-slate-900 uppercase">{settings.watchPageBannerSource}</span>
                </div>
                <div className="flex justify-between p-2 rounded-xl bg-white/5 light:bg-black/5">
                  <span className="text-slate-400 light:text-slate-700">Homepage Spotlight:</span>
                  <span className="font-bold text-white light:text-slate-900 uppercase">{settings.homepageSpotlightSource}</span>
                </div>
                <div className="flex justify-between p-2 rounded-xl bg-white/5 light:bg-black/5">
                  <span className="text-slate-400 light:text-slate-700">Weekly Featured Carousel:</span>
                  <span className="font-bold text-emerald-400 light:text-emerald-700">
                    {settings.weeklyFeaturedEnabled ? "ON (Custom Ad Poster)" : "OFF (User Videos - Default)"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2-5. PLACEMENT SUB-PANELS (Homepage, Watch, Weekly Featured, Spotlight) */}
        {(activePanel === "homepage" ||
          activePanel === "watch" ||
          activePanel === "weekly_featured" ||
          activePanel === "homepage_spotlight") && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white light:text-slate-900 block">
                  {PLACEMENT_LABELS[activePanel as Placement] || "Ad Placement"} Status
                </span>
                <span className="text-[11px] text-slate-400 light:text-slate-600">
                  {activePanel === "weekly_featured"
                    ? "OFF (Default): Shows users' Weekly Featured videos. ON: Swaps poster to admin's custom uploaded ad poster."
                    : "Select how this slot delivers ads to viewers across InPlayer."}
                </span>
              </div>
              {activePanel === "weekly_featured" ? (
                <button
                  type="button"
                  onClick={() => {
                    updateSettings("weeklyFeaturedEnabled", !settings.weeklyFeaturedEnabled);
                    saveSettings();
                  }}
                  className={`rounded-full px-3.5 py-1 text-xs font-bold transition ${
                    settings.weeklyFeaturedEnabled
                      ? "bg-emerald-500/20 text-emerald-300 light:bg-emerald-100 light:text-emerald-800"
                      : "bg-white/5 text-slate-400 light:bg-black/5"
                  }`}
                >
                  {settings.weeklyFeaturedEnabled ? "ON (Custom Ad Poster Mode)" : "OFF (User Videos Mode - Default)"}
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  {(["off", "house", "adsense"] as AdSlotSource[]).map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => {
                        if (activePanel === "homepage") updateSettings("homepageBannerSource", src);
                        if (activePanel === "watch") updateSettings("watchPageBannerSource", src);
                        if (activePanel === "homepage_spotlight") updateSettings("homepageSpotlightSource", src);
                        saveSettings();
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition capitalize ${
                        (activePanel === "homepage" && settings.homepageBannerSource === src) ||
                        (activePanel === "watch" && settings.watchPageBannerSource === src) ||
                        (activePanel === "homepage_spotlight" && settings.homepageSpotlightSource === src)
                          ? "bg-indigo-600 text-white"
                          : "bg-white/5 text-slate-400 light:bg-black/5 light:text-slate-700"
                      }`}
                    >
                      {src}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Upload & AI Tools Form */}
            <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 light:border-black/10 pb-2">
                <span className="text-xs font-bold text-white light:text-slate-900">
                  Upload Ad (Image or Video)
                </span>
                <button
                  type="button"
                  onClick={() => generateMagicAiAd(activePanel as Placement)}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-pink-500 px-3.5 py-1 text-[11px] font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
                >
                  <Sparkles size={13} /> Magic AI Auto-Generate
                </button>
              </div>

              {/* Title & Prominent High-Contrast AI Title Button */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 light:text-slate-600">Ad Title</label>
                  <button
                    type="button"
                    onClick={() => generateTitleWithAi(activePanel, false)}
                    disabled={generatingTitleAi}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-bold text-[11px] px-3 py-1 shadow-md hover:opacity-90 transition cursor-pointer light:from-indigo-600 light:to-purple-700 disabled:opacity-50"
                  >
                    {generatingTitleAi ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                    Generate Title with AI
                  </button>
                </div>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder={`Title for ${PLACEMENT_LABELS[activePanel as Placement] || "Ad Placement"}`}
                  className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-1.5 text-xs text-white light:text-slate-900 outline-none focus:border-indigo-400"
                />
              </div>

              {/* Destination Link */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 light:text-slate-600 mb-1">Destination Link URL</label>
                <input
                  type="text"
                  value={uploadLink}
                  onChange={(e) => setUploadLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-1.5 text-xs text-white light:text-slate-900 outline-none focus:border-indigo-400"
                />
              </div>

              {/* File Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 light:text-slate-600 mb-1">Select Media (Image or Video)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="block w-full text-[11px] text-slate-400 light:text-slate-700 file:mr-2.5 file:rounded-xl file:border file:border-indigo-500/30 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white hover:file:bg-indigo-500 cursor-pointer shadow-sm"
                />
              </div>

              {/* File Preview + X Remove Button + AI Crop & Redesign Button */}
              {uploadPreview && (
                <div className="space-y-2">
                  <div className="relative rounded-xl border border-white/10 light:border-black/10 overflow-hidden bg-black/40 max-h-48 flex items-center justify-center p-1">
                    {uploadFileType === "video" || uploadPreview.startsWith("data:video/") ? (
                      <video src={uploadPreview} controls className="max-h-44 w-auto rounded-lg" />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={uploadPreview} alt="Preview" className="max-h-44 w-auto object-contain rounded-lg" />
                    )}

                    {/* X Clear Button */}
                    <button
                      type="button"
                      onClick={() => clearFileSelection(false)}
                      className="absolute top-2 right-2 rounded-full bg-red-600 text-white p-1 shadow-md hover:bg-red-500 transition cursor-pointer"
                      title="Remove / Clear selected file"
                    >
                      <X size={14} />
                    </button>

                    <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase">
                      {uploadFileType || "Preview"}
                    </span>
                  </div>

                  {/* AI Crop & Redesign Image Button */}
                  {uploadFileType !== "video" && !uploadPreview.startsWith("data:video/") && (
                    <button
                      type="button"
                      onClick={() => handleAiCropAndRedesign(activePanel as Placement)}
                      disabled={croppingAi}
                      className="flex items-center gap-1.5 rounded-xl bg-purple-600/30 border border-purple-500/40 px-3 py-1.5 text-xs font-bold text-purple-300 light:text-purple-900 hover:bg-purple-600/40 transition disabled:opacity-50 cursor-pointer"
                    >
                      {croppingAi ? <Loader2 size={13} className="animate-spin" /> : <Crop size={13} />}
                      Crop & Redesign with AI
                    </button>
                  )}
                </div>
              )}

              {uploadError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-300 light:text-red-700">
                  <AlertTriangle size={14} /> <span>{uploadError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => submitCreative(activePanel as Placement)}
                disabled={!canUploadBanner || uploading}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
              >
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Publish Creative
              </button>
            </div>

            {/* List of Existing Creatives */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-white light:text-slate-900">
                Active Creatives ({safeCreatives.filter((c) => c?.placement === activePanel).length})
              </h3>
              {safeCreatives.filter((c) => c?.placement === activePanel).length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No ad creatives uploaded for this placement yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {safeCreatives
                    .filter((c) => c?.placement === activePanel)
                    .map((ad) => {
                      const imgUrl = String(ad?.imageUrl || "");
                      const isVideo = imgUrl.startsWith("data:video/") || imgUrl.endsWith(".mp4");
                      return (
                        <div key={ad.adId} className="rounded-xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-3 space-y-2">
                          <div className="relative h-28 overflow-hidden rounded-lg border border-white/10 light:border-black/10 bg-black/40 flex items-center justify-center">
                            {isVideo ? (
                              <video src={imgUrl} controls className="h-full w-auto" />
                            ) : (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={imgUrl} alt={ad.title || "Ad"} className="h-full w-full object-cover" />
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <p className="truncate font-bold text-white light:text-slate-900">{ad.title || "Untitled Ad"}</p>
                            <button
                              type="button"
                              onClick={() => toggleActive(ad)}
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
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
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. MID-ROLL VIDEO ADS SUB-PANEL */}
        {activePanel === "midroll" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white light:text-slate-900 block">Video Player Mid-Roll Engine</span>
                <span className="text-[11px] text-slate-400 light:text-slate-600">
                  Interrupts video playback at set intervals with skip timer escalation.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  updateSettings("midrollEnabled", !settings.midrollEnabled);
                  saveSettings();
                }}
                className={`rounded-full px-3.5 py-1 text-xs font-bold transition ${
                  settings.midrollEnabled
                    ? "bg-emerald-500/20 text-emerald-300 light:bg-emerald-100 light:text-emerald-800"
                    : "bg-white/5 text-slate-400 light:bg-black/5"
                }`}
              >
                {settings.midrollEnabled ? "ON" : "OFF"}
              </button>
            </div>

            {/* Form */}
            <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 light:border-black/10 pb-2">
                <span className="text-xs font-bold text-white light:text-slate-900">Upload Mid-Roll Creative (Image or Video)</span>
                <button
                  type="button"
                  onClick={generateMagicAiMidroll}
                  className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-pink-500 px-3.5 py-1 text-[11px] font-bold text-white shadow-sm transition hover:opacity-90 cursor-pointer"
                >
                  <Sparkles size={13} /> Magic AI Mid-Roll Generator
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 light:text-slate-600">Ad Title</label>
                  <button
                    type="button"
                    onClick={() => generateTitleWithAi("midroll", true)}
                    disabled={midrollGeneratingTitleAi}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-bold text-[11px] px-3 py-1 shadow-md hover:opacity-90 transition cursor-pointer light:from-indigo-600 light:to-purple-700 disabled:opacity-50"
                  >
                    {midrollGeneratingTitleAi ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                    Generate Title with AI
                  </button>
                </div>
                <input
                  type="text"
                  value={midrollTitle}
                  onChange={(e) => setMidrollTitle(e.target.value)}
                  placeholder="Title for Mid-Roll Ad"
                  className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-1.5 text-xs text-white light:text-slate-900 outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 light:text-slate-600 mb-1">Destination Link URL</label>
                <input
                  type="text"
                  value={midrollLink}
                  onChange={(e) => setMidrollLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-1.5 text-xs text-white light:text-slate-900 outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 light:text-slate-600 mb-1">Select Media (Image or Video)</label>
                <input
                  ref={midrollFileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleMidrollFileChange}
                  className="block w-full text-[11px] text-slate-400 light:text-slate-700 file:mr-2.5 file:rounded-xl file:border file:border-indigo-500/30 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white hover:file:bg-indigo-500 cursor-pointer shadow-sm"
                />
              </div>

              {midrollPreview && (
                <div className="space-y-2">
                  <div className="relative rounded-xl border border-white/10 light:border-black/10 overflow-hidden bg-black/40 max-h-48 flex items-center justify-center p-1">
                    {midrollFileType === "video" || midrollPreview.startsWith("data:video/") ? (
                      <video src={midrollPreview} controls className="max-h-44 w-auto rounded-lg" />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={midrollPreview} alt="Preview" className="max-h-44 w-auto object-contain rounded-lg" />
                    )}

                    {/* X Clear Button */}
                    <button
                      type="button"
                      onClick={() => clearFileSelection(true)}
                      className="absolute top-2 right-2 rounded-full bg-red-600 text-white p-1 shadow-md hover:bg-red-500 transition cursor-pointer"
                      title="Remove / Clear selected file"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {midrollFileType !== "video" && !midrollPreview.startsWith("data:video/") && (
                    <button
                      type="button"
                      onClick={handleAiCropMidroll}
                      disabled={midrollCroppingAi}
                      className="flex items-center gap-1.5 rounded-xl bg-purple-600/30 border border-purple-500/40 px-3 py-1.5 text-xs font-bold text-purple-300 light:text-purple-900 hover:bg-purple-600/40 transition disabled:opacity-50 cursor-pointer"
                    >
                      {midrollCroppingAi ? <Loader2 size={13} className="animate-spin" /> : <Crop size={13} />}
                      Crop & Redesign with AI
                    </button>
                  )}
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
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
              >
                {midrollUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Save Mid-Roll Ad
              </button>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {safeMidrollAds.map((ad) => {
                const imgUrl = String(ad?.imageUrl || "");
                const isVideo = imgUrl.startsWith("data:video/") || imgUrl.endsWith(".mp4");
                return (
                  <div key={ad.adId} className="rounded-xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-3 space-y-2">
                    <div className="relative h-28 overflow-hidden rounded-lg border border-white/10 light:border-black/10 bg-black/40 flex items-center justify-center">
                      {isVideo ? (
                        <video src={imgUrl} controls className="h-full w-auto" />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={imgUrl} alt={ad.title || "Midroll"} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <p className="truncate font-bold text-white light:text-slate-900">{ad.title || "Untitled Mid-Roll"}</p>
                      <button
                        type="button"
                        onClick={() => toggleMidrollActive(ad)}
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
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
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 7. GOOGLE ADSENSE SUB-PANEL */}
        {activePanel === "adsense" && (
          <div className="space-y-3 max-w-2xl">
            <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 space-y-3">
              <h3 className="text-xs font-bold text-white light:text-slate-900">Google AdSense Integration</h3>
              <p className="text-xs text-slate-400 light:text-slate-600">
                Enter your official Google AdSense Publisher ID to enable AdSense banner units.
              </p>
              <input
                type="text"
                value={settings.adsensePublisherId}
                onChange={(e) => {
                  updateSettings("adsensePublisherId", e.target.value.trim());
                  updateSettings("adsenseEnabled", e.target.value.trim().length > 0);
                }}
                placeholder="pub-1234567890123456"
                className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-2 text-xs text-white light:text-slate-900 outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save AdSense Config
              </button>
            </div>
          </div>
        )}

        {/* 8. POSTER SPECS & RATIOS SUB-PANEL */}
        {activePanel === "specs" && (
          <div className="max-w-3xl rounded-2xl border border-indigo-500/20 light:border-indigo-600/30 bg-indigo-500/10 p-5 text-xs space-y-3">
            <h3 className="font-bold text-sm text-indigo-300 light:text-indigo-950 flex items-center gap-1.5">
              📐 Recommended Ad Poster Specifications & Aspect Ratios
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300 light:text-slate-800 font-medium">
              <div className="rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 p-3 space-y-1">
                <strong className="block text-white light:text-slate-900 font-bold">Homepage Feed Ad Card (Slots 13 & 16)</strong>
                <code className="inline-block rounded bg-orange-500/20 light:bg-orange-100 px-1.5 py-0.5 font-bold text-orange-300 light:text-amber-900">16:9 Native Video Card ratio</code>
                <p className="text-[11px] text-slate-400 light:text-slate-600">Blends natively into the homepage 4-column grid as a video thumbnail card (1920 × 1080 px or 1200 × 675 px image/video with Sponsored Ad tag).</p>
              </div>
              <div className="rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 p-3 space-y-1">
                <strong className="block text-white light:text-slate-900 font-bold">Weekly Featured Banner</strong>
                <code className="inline-block rounded bg-orange-500/20 light:bg-orange-100 px-1.5 py-0.5 font-bold text-orange-300 light:text-amber-900">16:5 aspect ratio</code>
                <p className="text-[11px] text-slate-400 light:text-slate-600">Recommended: 1920 × 600 px image or .mp4 video clip.</p>
              </div>
              <div className="rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 p-3 space-y-1">
                <strong className="block text-white light:text-slate-900 font-bold">Video Player Mid-Roll Ads</strong>
                <code className="inline-block rounded bg-orange-500/20 light:bg-orange-100 px-1.5 py-0.5 font-bold text-orange-300 light:text-amber-900">16:9 aspect ratio</code>
                <p className="text-[11px] text-slate-400 light:text-slate-600">Recommended: 1920 × 1080 px image or .mp4 clip (up to 30s).</p>
              </div>
              <div className="rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 p-3 space-y-1">
                <strong className="block text-white light:text-slate-900 font-bold">Homepage Spotlight</strong>
                <code className="inline-block rounded bg-orange-500/20 light:bg-orange-100 px-1.5 py-0.5 font-bold text-orange-300 light:text-amber-900">16:9 or 4:3 aspect ratio</code>
                <p className="text-[11px] text-slate-400 light:text-slate-600">Recommended: 1200 × 675 px.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdvertisingPageWrapper() {
  return (
    <AdvertisingErrorBoundary>
      <AdvertisingPage />
    </AdvertisingErrorBoundary>
  );
}
