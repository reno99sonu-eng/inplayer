"use client";

import { Component, ReactNode, useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Palette,
  Power,
  Trash2,
  Eye,
  Search,
  Menu,
  Bell,
  User,
} from "lucide-react";
import {
  PRESET_OCCASIONS,
  generateAiNavbarThemeImage,
} from "@/app/lib/aiNavbarThemeGenerator";

interface NavbarThemeData {
  active: boolean;
  themeId: string;
  occasionId: string;
  occasionName: string;
  title: string;
  imageUrl: string;
  updatedAt: string;
}

// In-Page Error Boundary to isolate rendering errors
interface BoundaryProps {
  children: ReactNode;
}
interface BoundaryState {
  hasError: boolean;
  errorMsg: string;
}

class NavbarThemeErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return {
      hasError: true,
      errorMsg: error?.message || "An error occurred while loading the Navbar Theme Manager.",
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center space-y-3 my-8 max-w-xl mx-auto">
          <AlertTriangle size={32} className="text-red-400 mx-auto" />
          <h3 className="text-lg font-bold text-white light:text-slate-900">Navbar Theme Manager Recovery</h3>
          <p className="text-xs text-red-300 light:text-red-700 max-w-md mx-auto">{this.state.errorMsg}</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, errorMsg: "" });
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition cursor-pointer"
          >
            <RefreshCw size={14} /> Reload Section
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function NavbarThemeManagerPage() {
  return (
    <NavbarThemeErrorBoundary>
      <NavbarThemeManagerContent />
    </NavbarThemeErrorBoundary>
  );
}

function NavbarThemeManagerContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [activeTheme, setActiveTheme] = useState<NavbarThemeData | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<string>("independence_day");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [generatedTitle, setGeneratedTitle] = useState<string>("Independence Day Celebration Theme");
  const [previewImageUrl, setPreviewImageUrl] = useState<string>("");

  const authedFetch = async (url: string, init?: RequestInit) => {
    let session = await fetchAuthSession().catch(() => null);
    let token = session?.tokens?.idToken?.toString();
    if (!token) {
      session = await fetchAuthSession({ forceRefresh: true }).catch(() => null);
      token = session?.tokens?.idToken?.toString();
    }
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };

  const loadActiveTheme = async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/admin/navbar-theme");
      if (res.ok) {
        const data = await res.json();
        if (data?.theme) {
          setActiveTheme(data.theme);
          setPreviewImageUrl(data.theme.imageUrl || "");
          setGeneratedTitle(data.theme.title || "Active Occasion Theme");
          if (data.theme.occasionId) setSelectedOccasion(data.theme.occasionId);
        }
      }
    } catch (err) {
      console.error("Failed to load active navbar theme:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveTheme();
  }, []);

  // Initial preview image generation if empty
  useEffect(() => {
    if (!previewImageUrl && !loading) {
      handleAiGenerate();
    }
  }, [loading]);

  const handleAiGenerate = () => {
    setGenerating(true);
    setError(null);
    try {
      const preset = PRESET_OCCASIONS.find((o) => o.id === selectedOccasion);
      const title = selectedOccasion === "custom" && customPrompt.trim()
        ? customPrompt.trim()
        : preset?.name || "Occasion Celebration Theme";

      const generatedUrl = generateAiNavbarThemeImage(selectedOccasion, customPrompt);
      setPreviewImageUrl(generatedUrl);
      setGeneratedTitle(title);
      setSuccessMsg("AI generated new navbar theme pattern successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error("Failed to generate AI theme:", err);
      setError("AI generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handlePublishTheme = async () => {
    if (!previewImageUrl) {
      setError("Please generate a theme image first.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const preset = PRESET_OCCASIONS.find((o) => o.id === selectedOccasion);
      const payload = {
        occasionId: selectedOccasion,
        occasionName: preset?.name || "Occasion Theme",
        title: generatedTitle,
        imageUrl: previewImageUrl,
        active: true,
      };

      const res = await authedFetch("/api/admin/navbar-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save theme in DynamoDB.");
      }

      const data = await res.json();
      if (data?.theme) {
        setActiveTheme(data.theme);
        setSuccessMsg("🎉 Navbar occasion theme published & applied live!");
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error("Theme publish error:", err);
      setError(err instanceof Error ? err.message : "Failed to publish theme.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetTheme = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await authedFetch("/api/admin/navbar-theme", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to reset theme.");
      }

      setActiveTheme(null);
      setPreviewImageUrl("");
      setSuccessMsg("Reset navbar background theme to default.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error("Theme reset error:", err);
      setError(err instanceof Error ? err.message : "Failed to reset theme.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="rounded-3xl border border-indigo-500/20 light:border-slate-300 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-950/80 light:from-indigo-900 light:to-purple-900 p-6 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/20 px-3 py-1 text-xs font-black text-indigo-200">
              <Sparkles size={14} className="animate-spin text-amber-300" /> AI OCCASION THEME MANAGER
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">Top Navbar Occasion Themes</h1>
            <p className="text-xs sm:text-sm text-slate-200 font-medium">
              Auto-generate and apply background occasion themes (Independence Day 🇮🇳, Diwali 🪔, Holi 🎨, etc.) without affecting top navbar layout, buttons, logos, or contrast across devices.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetTheme}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/20 px-4 py-2.5 text-xs font-bold text-red-200 hover:bg-red-500/30 transition cursor-pointer"
            >
              <Trash2 size={14} /> Clear Active Theme
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 light:bg-red-100 p-4 text-xs font-bold text-red-300 light:text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 light:bg-emerald-100 p-4 text-xs font-bold text-emerald-300 light:text-emerald-900 flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column — Occasion Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl border border-white/10 light:border-slate-300 bg-white/[0.03] light:bg-white/90 p-5 space-y-5 backdrop-blur-xl shadow-lg light:shadow-md">
            <h2 className="text-base font-black text-white light:text-slate-900 flex items-center gap-2">
              <Palette size={18} className="text-indigo-400 light:text-indigo-600" /> Choose Festive Occasion
            </h2>

            <div className="space-y-2">
              {PRESET_OCCASIONS.map((occ) => (
                <button
                  key={occ.id}
                  type="button"
                  onClick={() => setSelectedOccasion(occ.id)}
                  className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 text-xs font-black transition text-left cursor-pointer ${
                    selectedOccasion === occ.id
                      ? "border-indigo-500 bg-indigo-500/20 light:bg-indigo-100 text-white light:text-indigo-950 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                      : "border-white/10 light:border-slate-300 bg-black/20 light:bg-slate-100/90 text-slate-300 light:text-slate-800 hover:bg-white/10 light:hover:bg-slate-200"
                  }`}
                >
                  <span>{occ.name}</span>
                  {selectedOccasion === occ.id && <CheckCircle2 size={16} className="text-indigo-400 light:text-indigo-600" />}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setSelectedOccasion("custom")}
                className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 text-xs font-black transition text-left cursor-pointer ${
                  selectedOccasion === "custom"
                    ? "border-pink-500 bg-pink-500/20 light:bg-pink-100 text-white light:text-pink-950 shadow-[0_0_20px_rgba(236,72,153,0.2)]"
                    : "border-white/10 light:border-slate-300 bg-black/20 light:bg-slate-100/90 text-slate-300 light:text-slate-800 hover:bg-white/10 light:hover:bg-slate-200"
                }`}
              >
                <span>Custom Occasion Prompt ✨</span>
                {selectedOccasion === "custom" && <CheckCircle2 size={16} className="text-pink-400 light:text-pink-600" />}
              </button>
            </div>

            {selectedOccasion === "custom" && (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-300 light:text-slate-800">Custom Celebration Prompt</label>
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g., Grand Musical Concert Festival"
                  className="w-full rounded-xl border border-white/10 light:border-slate-300 bg-black/40 light:bg-white px-3.5 py-2.5 text-xs font-bold text-white light:text-slate-900 placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 px-5 py-3 text-xs font-black text-slate-950 shadow-lg hover:opacity-95 transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={16} className={generating ? "animate-spin" : ""} />
                {generating ? "AI Generating Background Graphic..." : "Magic AI Auto-Generate Theme"}
              </button>

              <button
                type="button"
                onClick={handlePublishTheme}
                disabled={saving || !previewImageUrl}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-5 py-3 text-xs font-black text-white shadow-lg hover:opacity-95 transition cursor-pointer disabled:opacity-50"
              >
                <Power size={16} />
                {saving ? "Publishing Theme..." : "Apply & Publish Theme Live"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column — Live Interactive Mockup */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl border border-white/10 light:border-slate-300 bg-white/[0.03] light:bg-white/90 p-5 space-y-4 backdrop-blur-xl shadow-lg light:shadow-md">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-white light:text-slate-900 flex items-center gap-2">
                <Eye size={18} className="text-amber-400 light:text-amber-600" /> Live Top Navbar Mockup & Preview
              </h2>
              {activeTheme && (
                <span className="rounded-full bg-emerald-500/20 light:bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-400 light:text-emerald-800 border border-emerald-500/30 light:border-emerald-300">
                  LIVE ON PLATFORM
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 light:text-slate-700 font-semibold">
              Verify how the generated theme background sits behind the top navbar logo, search bar, and action buttons without overlapping or reducing legibility.
            </p>

            {/* Mock Top Navbar Frame */}
            <div className="relative overflow-hidden rounded-2xl border border-white/20 light:border-slate-400 bg-[#06101D] shadow-2xl min-h-[90px] flex flex-col justify-center px-4 py-3">
              {/* Background Theme Layer */}
              {previewImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewImageUrl}
                  alt="Navbar Theme Background"
                  className="absolute inset-0 h-full w-full object-cover opacity-90 pointer-events-none z-0"
                />
              ) : (
                <div className="absolute inset-0 bg-[#06101D] z-0" />
              )}

              {/* Automatic Contrast Overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/30 to-black/50 backdrop-blur-[2px] z-0" />

              {/* Navbar Foreground Elements (Logo, Search, Buttons) */}
              <div className="relative z-10 flex items-center justify-between gap-3">
                {/* Logo & Menu */}
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 border border-white/15 text-white backdrop-blur-md">
                    <Menu size={18} />
                  </div>
                  <div className="flex items-center gap-1 text-white font-black text-sm tracking-wider">
                    <Flame size={18} className="text-orange-500 fill-orange-500" />
                    <span>INPLAYER</span>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="hidden sm:flex flex-1 max-w-xs items-center gap-2 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 backdrop-blur-md text-xs text-slate-300">
                  <Search size={14} className="text-slate-400" />
                  <span className="truncate">Search creators...</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 border border-white/15 text-white backdrop-blur-md">
                    <Bell size={14} />
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-slate-950 font-black text-xs">
                    <User size={14} />
                  </div>
                </div>
              </div>
            </div>

            {/* Details Summary */}
            <div className="rounded-2xl border border-white/10 light:border-slate-300 bg-black/30 light:bg-slate-100 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 light:text-slate-600 font-bold">Current Theme Title:</span>
                <span className="font-bold text-white light:text-slate-900">{generatedTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 light:text-slate-600 font-bold">Occasion Preset:</span>
                <span className="font-bold text-indigo-300 light:text-indigo-700">{selectedOccasion.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 light:text-slate-600 font-bold">Layout Safety:</span>
                <span className="font-bold text-emerald-400 light:text-emerald-700">Protected (Z-Index 0 + Contrast Blur)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
