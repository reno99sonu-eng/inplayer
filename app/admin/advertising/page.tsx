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
} from "lucide-react";
import { compressImageToBanner } from "@/app/lib/imageCompress";


type AdSlotSource = "house" | "adsense" | "off";
type Placement = "homepage" | "watch" | "homepage_spotlight";

const PLACEMENT_LABELS: Record<Placement, string> = {
  homepage: "Homepage banner",
  watch: "Watch page",
  homepage_spotlight: "Homepage spotlight",
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
    <div className="flex items-center gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
            value === o.value
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white/5 text-slate-300 hover:bg-white/10 light:bg-slate-200/80 light:text-slate-800 light:hover:bg-slate-300"
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

  const [midrollAds, setMidrollAds] = useState<MidrollAdCreative[]>([]);
  const [midrollLoading, setMidrollLoading] = useState(true);
  const [midrollError, setMidrollError] = useState<string | null>(null);
  const [midrollTitle, setMidrollTitle] = useState("");
  const [midrollLink, setMidrollLink] = useState("");
  const [midrollPreview, setMidrollPreview] = useState<string | null>(null);
  const [midrollUploading, setMidrollUploading] = useState(false);
  const [midrollUploadError, setMidrollUploadError] = useState<string | null>(null);
  const midrollFileInputRef = useRef<HTMLInputElement>(null);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
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
        <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-bold text-white light:text-slate-900">
                Homepage spotlight
              </span>
              <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                A second, static homepage slot — shown below the feed, in both Horizontal and Shorts view.
              </p>
            </div>
            <SourcePicker
              value={settings.homepageSpotlightSource}
              onChange={(v) => update("homepageSpotlightSource", v)}
            />
          </div>
        </div>

        {/* Weekly Featured Banner Toggle */}
        <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-bold text-white light:text-slate-900">
                Weekly Featured Banner
              </span>
              <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                Switch off the top Weekly Featured video hero carousel to run exclusively with your uploaded ad posters & banners.
              </p>
            </div>
            <button
              type="button"
              onClick={() => update("weeklyFeaturedEnabled", !settings.weeklyFeaturedEnabled)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                settings.weeklyFeaturedEnabled !== false
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              {settings.weeklyFeaturedEnabled !== false ? "On" : "Off"}
            </button>
          </div>
        </div>

        {/* Ad Poster Specifications & Aspect Ratios */}
        <div className="rounded-3xl border border-indigo-500/20 bg-indigo-500/10 p-5 text-xs space-y-2">
          <h3 className="font-bold text-sm text-indigo-300 flex items-center gap-1.5">
            📐 Recommended Ad Poster Sizes & Aspect Ratios
          </h3>
          <p className="text-slate-300">
            For crisp, responsive rendering across mobile, tablet, and desktop screens:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300 font-medium">
            <li><strong className="text-white">Homepage & Watch Banners:</strong> <code className="text-orange-300">16:5 aspect ratio</code> (Recommended: 1200 × 375 px or 1920 × 600 px image/video).</li>
            <li><strong className="text-white">Video Player Mid-Roll Ads:</strong> <code className="text-orange-300">16:9 aspect ratio</code> (Recommended: 1920 × 1080 px image or .mp4 video clip up to 30s).</li>
            <li><strong className="text-white">Homepage Spotlight:</strong> <code className="text-orange-300">16:9 or 4:3 aspect ratio</code> (Recommended: 1200 × 675 px).</li>
          </ul>
        </div>

        {/* Mid-roll video ads */}
        <div className="rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white light:text-slate-900">Mid-roll video ads</h3>
              <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                A real ad break interrupts playback at the interval below. Skip timers escalate the
                longer a viewer keeps watching the same video: 5s on the first break, 10s on the
                second, 15s on the third and every one after that.
              </p>
            </div>
            <button
              type="button"
              onClick={() => update("midrollEnabled", !settings.midrollEnabled)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                settings.midrollEnabled
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              {settings.midrollEnabled ? "On" : "Off"}
            </button>
          </div>
          {settings.midrollEnabled && (
            <div className="mt-3">
              <label className="mb-1.5 block text-xs font-semibold text-slate-400 light:text-slate-600">
                Minimum seconds of watch time between breaks
              </label>
              <input
                type="number"
                min={60}
                max={3600}
                value={settings.midrollIntervalSeconds}
                onChange={(e) =>
                  update("midrollIntervalSeconds", Math.max(60, Math.min(3600, Number(e.target.value) || 300)))
                }
                className="w-40 rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-2 text-sm text-white light:text-slate-900 outline-none focus:border-indigo-400/50"
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                A short video may never reach the first break — that&apos;s expected, not a bug.
              </p>
            </div>
          )}
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
          <div className="flex flex-wrap items-center gap-2">
            {(["homepage", "watch", "homepage_spotlight"] as Placement[]).map((p) => (
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
                {PLACEMENT_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold text-slate-400 light:text-slate-600">
              Ad Poster or Video Media (Images or .mp4 Videos)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-white/20"
            />
            {uploadPreview && (
              uploadPreview.startsWith("data:video/") ? (
                <video
                  src={uploadPreview}
                  controls
                  className="mt-3 max-h-44 w-full rounded-xl border border-white/10 object-contain"
                />
              ) : (
                <img
                  src={uploadPreview}
                  alt="Preview"
                  className="mt-3 w-full rounded-xl border border-white/10 light:border-black/10 object-cover max-h-44"
                />
              )
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
                    {PLACEMENT_LABELS[ad.placement] || ad.placement}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Eye size={12} /> {Number(ad.impressions || 0).toLocaleString("en-IN")}
                  </span>
                  <span className="flex items-center gap-1">
                    <MousePointerClick size={12} /> {Number(ad.clicks || 0).toLocaleString("en-IN")}
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

      {/* Mid-roll ad creatives */}
      <div className="mt-8">
        <h3 className="text-sm font-bold text-white light:text-slate-900">Mid-roll ad creatives</h3>
        <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
          Shown full-screen over a paused player when a viewer hits a mid-roll break (see the toggle
          above). Multiple active creatives rotate randomly, same as banner slots.
        </p>

        <div className="mt-4 max-w-2xl rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-400 light:text-slate-600">
              Ad image (any aspect — shown centered over the player)
            </label>
            <input
              ref={midrollFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleMidrollFileChange}
              className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-white/20"
            />
            {midrollPreview && (
              /* eslint-disable-next-line @next/next/no-img-element -- a
                 freshly compressed in-memory data URL, not a static app
                 asset next/image can optimize. */
              <img
                src={midrollPreview}
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
              value={midrollTitle}
              onChange={(e) => setMidrollTitle(e.target.value)}
              placeholder="e.g. Membership push"
              className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-2 text-sm text-white light:text-slate-900 outline-none focus:border-indigo-400/50"
            />
          </div>

          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-semibold text-slate-400 light:text-slate-600">
              Link URL
            </label>
            <input
              type="text"
              value={midrollLink}
              onChange={(e) => setMidrollLink(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-2 text-sm text-white light:text-slate-900 outline-none focus:border-indigo-400/50"
            />
          </div>

          {midrollUploadError && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{midrollUploadError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={submitMidrollAd}
            disabled={!canUploadMidroll || midrollUploading}
            className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(139,92,246,.25)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {midrollUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Add creative
          </button>
        </div>

        {midrollError && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-700">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{midrollError}</span>
          </div>
        )}

        {midrollLoading ? (
          <div className="flex min-h-[15vh] items-center justify-center">
            <Loader2 size={20} className="animate-spin text-indigo-400" />
          </div>
        ) : midrollAds.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center">
            <ImagePlus size={26} className="text-slate-600" />
            <p className="text-sm text-slate-500">No mid-roll creatives uploaded yet.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {midrollAds.map((ad) => (
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
                <p className="mt-2 truncate text-sm font-bold text-white light:text-slate-900">{ad.title}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Eye size={12} /> {Number(ad.impressions || 0).toLocaleString("en-IN")}
                  </span>
                  <span className="flex items-center gap-1">
                    <MousePointerClick size={12} /> {Number(ad.clicks || 0).toLocaleString("en-IN")}
                  </span>
                  <span className="flex items-center gap-1">Skipped {Number(ad.skips || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleMidrollActive(ad)}
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
                    onClick={() => deleteMidrollAd(ad)}
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
