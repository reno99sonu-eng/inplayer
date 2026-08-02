"use client";

import { useEffect, useState, useRef } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import Image from "next/image";
import Link from "next/link";
import {
  LayoutDashboard,
  Film,
  PlaySquare,
  Pencil,
  DollarSign,
  HelpCircle,
  Trash2,
  Loader2,
  X,
  Check,
  ExternalLink,
  Plus,
  Save,
  UserCheck,
  Globe,
  Sparkles,
  User,
} from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { formatViews, formatTimeAgo } from "@/app/lib/formatters";
import ChannelAnalytics, { ContentStats } from "@/app/components/analytics/ChannelAnalytics";
import RevenueSection, { PayoutStatus } from "@/app/components/analytics/RevenueSection";
import { TrendPoint } from "@/app/components/analytics/TrendChart";
import HowInPlayerWorks from "@/app/components/HowInPlayerWorks";
import { compressImageToThumbnail } from "@/app/lib/imageCompress";
import { buildAIGeneratePrompt, parseAITitleSuggestions } from "@/app/lib/aiPrompts";
import VideoMetadataFields, {
  VideoMetadataValue,
  SpokenLanguage,
  Visibility,
} from "@/app/components/VideoMetadataFields";
import AITitleAssistModal from "@/app/components/AITitleAssistModal";
import { CONTENT_CATEGORIES } from "@/app/data/categories";

const CATEGORIES = CONTENT_CATEGORIES;
const SPOKEN_LANGUAGE_VALUES = ["auto", "en", "hi", "bn"];
const VISIBILITY_VALUES = ["public", "unlisted", "private"];

interface MyVideo {
  videoId: string;
  title: string;
  description: string;
  category: string;
  status: string;
  thumbnailUrl?: string;
  muxPlaybackId?: string;
  views: number;
  uploadedAt: string;
  contentType?: string;
  tags?: string[];
  visibility?: string;
  madeForKids?: boolean;
  ageRestricted?: boolean;
  commentsEnabled?: boolean;
  spokenLanguage?: string;
  membersOnly?: boolean;
}

interface AnalyticsResponse {
  videos: ContentStats;
  shorts: ContentStats;
  subscriberCount: number;
  trend: { videos: TrendPoint[]; shorts: TrendPoint[] };
  trendAvailable: boolean;
}

const emptyContentStats: ContentStats = {
  count: 0,
  reach: 0,
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
};

type ActivePanel = "dashboard" | "videos" | "shorts" | "edit" | "profile" | "revenue" | "how-it-works";

export default function MyVideosPage() {
  const { signedIn, authLoading, openSignIn, user } = useAuthModal();
  const [videos, setVideos] = useState<MyVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActivePanel>("dashboard");

  // Channel Description / Bio State
  const [channelBio, setChannelBio] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);

  // Edit Video State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<VideoMetadataValue | null>(null);
  const [editTagInput, setEditTagInput] = useState("");
  const [editThumbnailPreview, setEditThumbnailPreview] = useState<string | null>(null);
  const [editThumbnailBusy, setEditThumbnailBusy] = useState(false);
  const [editThumbnailError, setEditThumbnailError] = useState<string | null>(null);
  const [selectedMuxThumbnail, setSelectedMuxThumbnail] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiTitleAssistOpen, setAiTitleAssistOpen] = useState(false);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(true);

  // Load Channel Bio from localStorage
  useEffect(() => {
    try {
      const savedBio = localStorage.getItem(`inplayer-channel-bio-${user?.userId || "me"}`);
      if (savedBio) setChannelBio(savedBio);
    } catch {
      /* ignore */
    }
  }, [user?.userId]);

  const handleSaveBio = () => {
    setSavingBio(true);
    try {
      localStorage.setItem(`inplayer-channel-bio-${user?.userId || "me"}`, channelBio);
      setBioSaved(true);
      setTimeout(() => setBioSaved(false), 2200);
    } catch (err) {
      console.error("Failed to save bio:", err);
    } finally {
      setSavingBio(false);
    }
  };

  useEffect(() => {
    if (!signedIn) {
      setLoading(false);
      setAnalyticsLoading(false);
      setPayoutLoading(false);
      return;
    }

    async function load() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        const headers = { Authorization: `Bearer ${idToken}` };

        const [videosRes, analyticsRes, payoutRes] = await Promise.all([
          fetch("/api/my-videos", { headers }),
          fetch("/api/my-videos/analytics", { headers }),
          fetch("/api/creator/payout-status", { headers }),
        ]);

        const videosData = await videosRes.json();
        setVideos(videosData.videos || []);
        setLoading(false);

        if (analyticsRes.ok) {
          setAnalytics(await analyticsRes.json());
        }
        setAnalyticsLoading(false);

        if (payoutRes.ok) {
          setPayoutStatus(await payoutRes.json());
        }
        setPayoutLoading(false);
      } catch (err) {
        console.error("Failed to load your channel:", err);
        setLoading(false);
        setAnalyticsLoading(false);
        setPayoutLoading(false);
      }
    }

    load();
  }, [signedIn]);

  const startEditing = (video: MyVideo) => {
    setEditingId(video.videoId);
    setEditValue({
      title: video.title,
      description: video.description || "",
      category: video.category,
      contentType: video.contentType === "short" ? "short" : "video",
      spokenLanguage: (SPOKEN_LANGUAGE_VALUES.includes(video.spokenLanguage || "")
        ? video.spokenLanguage
        : "auto") as SpokenLanguage,
      visibility: (VISIBILITY_VALUES.includes(video.visibility || "")
        ? video.visibility
        : "public") as Visibility,
      madeForKids: !!video.madeForKids,
      ageRestricted: !!video.ageRestricted,
      commentsEnabled: video.commentsEnabled !== false,
      tags: Array.isArray(video.tags) ? video.tags : [],
      membersOnly: !!video.membersOnly,
    });
    setEditTagInput("");
    setEditThumbnailPreview(null);
    setEditThumbnailBusy(false);
    setEditThumbnailError(null);
    setSelectedMuxThumbnail(null);
    setAiError(null);
    setAiSuggestions([]);
    setAiTitleAssistOpen(false);
    setError(null);
    setActiveTab("edit");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue(null);
    setSelectedMuxThumbnail(null);
    setAiError(null);
    setAiSuggestions([]);
    setAiTitleAssistOpen(false);
    setError(null);
    setActiveTab("videos");
  };

  const handleEditChange = <K extends keyof VideoMetadataValue>(
    field: K,
    val: VideoMetadataValue[K]
  ) => {
    setEditValue((prev) => (prev ? { ...prev, [field]: val } : prev));
  };

  const handleGenerateAI = async (
    type: "title" | "description" | "tags",
    userDescription?: string
  ) => {
    if (!editValue) return;

    setAiGenerating(true);
    setAiError(null);
    setAiSuggestions([]);

    try {
      const response = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: buildAIGeneratePrompt(type, {
            title: editValue.title,
            description: editValue.description,
            category: editValue.category,
            contentType: editValue.contentType,
            userDescription,
          }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI generation failed.");
      }

      if (type === "title") {
        setAiSuggestions(parseAITitleSuggestions(data.text));
      }
    } catch (err) {
      console.error(err);
      setAiError(err instanceof Error ? err.message : "AI couldn't generate content.");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleEditThumbnailSelected = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setEditThumbnailError("Please choose an image file.");
      return;
    }
    setEditThumbnailError(null);
    setEditThumbnailBusy(true);
    try {
      const dataUrl = await compressImageToThumbnail(file);
      setEditThumbnailPreview(dataUrl);
    } catch (err) {
      console.error("Thumbnail processing failed:", err);
      setEditThumbnailError("Couldn't process that image. Please try a different one.");
    } finally {
      setEditThumbnailBusy(false);
    }
  };

  const handleSave = async (videoId: string) => {
    if (!editValue) return;

    if (!editValue.title.trim()) {
      setError("Title can't be empty.");
      return;
    }

    setSavingId(videoId);
    setError(null);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch(`/api/my-videos/${videoId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          title: editValue.title.trim(),
          description: editValue.description.trim(),
          category: editValue.category,
          tags: editValue.tags,
          visibility: editValue.visibility,
          madeForKids: editValue.madeForKids,
          ageRestricted: editValue.ageRestricted,
          commentsEnabled: editValue.commentsEnabled,
          spokenLanguage: editValue.spokenLanguage,
          membersOnly: editValue.contentType === "video" ? editValue.membersOnly : undefined,
          thumbnailDataUrl: editThumbnailPreview || undefined,
          thumbnailUrl: selectedMuxThumbnail || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Couldn't save changes.");
        return;
      }

      setVideos((prev) =>
        prev.map((v) =>
          v.videoId === videoId
            ? {
                ...v,
                title: editValue.title.trim(),
                description: editValue.description.trim(),
                category: editValue.category,
                tags: editValue.tags,
                visibility: editValue.visibility,
                madeForKids: editValue.madeForKids,
                ageRestricted: editValue.ageRestricted,
                commentsEnabled: editValue.commentsEnabled,
                spokenLanguage: editValue.spokenLanguage,
                membersOnly: editValue.contentType === "video" ? editValue.membersOnly : v.membersOnly,
                thumbnailUrl:
                  editThumbnailPreview ||
                  selectedMuxThumbnail ||
                  v.thumbnailUrl,
              }
            : v
        )
      );
      setActiveTab(editValue.contentType === "short" ? "shorts" : "videos");
      setEditingId(null);
      setEditValue(null);
    } catch (err) {
      console.error("Failed to save video edits:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (videoId: string) => {
    setDeletingId(videoId);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch(`/api/my-videos/${videoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (res.ok) {
        setVideos((prev) => prev.filter((v) => v.videoId !== videoId));
      }
    } catch (err) {
      console.error("Failed to delete video:", err);
    } finally {
      setDeletingId(null);
      setConfirmingDeleteId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          Sign in to access Your Channel
        </h2>
        <p className="mt-2 text-sm text-slate-400 light:text-slate-600">
          Manage videos, shorts, channel bio, analytics, and revenue payouts.
        </p>
        <button
          onClick={openSignIn}
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-8 py-3 font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
        >
          Sign In
        </button>
      </div>
    );
  }

  const videoItems = videos.filter((v) => v.contentType !== "short");
  const shortItems = videos.filter((v) => v.contentType === "short");

  const totalViews = analytics ? analytics.videos.views + analytics.shorts.views : 0;
  const subscriberCount = analytics?.subscriberCount ?? 0;
  const activeEditingVideo = editingId ? videos.find((v) => v.videoId === editingId) : null;

  const sidebarNavItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "videos", label: "Videos Library", icon: Film, count: videoItems.length },
    { id: "shorts", label: "Raftaar Library", icon: PlaySquare, count: shortItems.length },
    { id: "edit", label: "Edit Content", icon: Pencil, disabled: false },
    { id: "profile", label: "Profile & Settings", icon: User },
    { id: "revenue", label: "Revenue & KYC", icon: DollarSign },
    { id: "how-it-works", label: "How It Works?", icon: HelpCircle },
  ] as const;

  return (
    <div className="mx-auto max-w-[1440px] px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      {/* Top Title Banner */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:mb-6">
        <div>
          <h1 className="text-xl font-black text-white light:text-slate-900 sm:text-2xl lg:text-3xl">
            Your Channel Studio
          </h1>
          <p className="text-xs text-slate-400 light:text-slate-600 sm:text-sm">
            Manage your profile, videos, shorts, analytics, and earnings in one place.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user?.handle && (
            <Link
              href={`/u/${encodeURIComponent(user.handle)}`}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 light:border-black/10 light:bg-black/5 light:text-slate-700"
            >
              <Globe size={14} className="text-orange-400" />
              View Public Channel
            </Link>
          )}

          <Link
            href="/upload"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 text-xs font-bold text-white shadow-md transition hover:-translate-y-0.5"
          >
            <Plus size={15} />
            Upload
          </Link>
        </div>
      </div>

      {/* Main Layout: Left Sidebar + Right Content Screen */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        {/* Left Side Individual Panel Buttons */}
        <aside className="w-full flex-shrink-0 lg:w-60">
          {/* Mobile / Tablet Horizontal Scroll Menu */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden">
            {sidebarNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as ActivePanel)}
                  className={`inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-xl px-3.5 text-xs font-bold transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-md"
                      : "border border-white/10 bg-[#071120] text-slate-300 light:border-black/10 light:bg-white light:text-slate-700"
                  }`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                  {"count" in item && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                        isActive ? "bg-white/20 text-white" : "bg-white/10 text-slate-400"
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Desktop Fixed Left Sidebar Panel */}
          <div className="hidden space-y-3 rounded-2xl border border-white/10 bg-[#071120] p-3 light:border-black/10 light:bg-white lg:block">
            {/* Channel Quick Info */}
            <div className="flex items-center gap-3 border-b border-white/10 pb-3 light:border-black/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user?.avatarUrl || "/avatars/avatar.png"}
                alt=""
                className="h-10 w-10 flex-shrink-0 rounded-full object-cover ring-2 ring-orange-400/40"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white light:text-slate-900">
                  {user?.name || "Your Channel"}
                </p>
                <p className="truncate text-xs font-medium text-slate-400 light:text-slate-600">
                  @{user?.handle || "creator"}
                </p>
              </div>
            </div>

            {/* Sidebar Individual Panel Buttons */}
            <nav className="space-y-1">
              {sidebarNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as ActivePanel)}
                    className={`flex h-10 w-full items-center justify-between rounded-xl px-3 text-xs font-bold transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-md"
                        : "text-slate-300 hover:bg-white/5 hover:text-white light:text-slate-700 light:hover:bg-black/5 light:hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 truncate">
                      <Icon size={16} className={isActive ? "text-white" : "text-orange-400"} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {"count" in item && (
                      <span
                        className={`ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          isActive ? "bg-white/20 text-white" : "bg-white/10 text-slate-400 light:bg-black/10 light:text-slate-600"
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Right Active Content Panel */}
        <main className="min-w-0 flex-1 space-y-5">
          {/* PANEL 1: DASHBOARD & CHANNEL BIO */}
          {activeTab === "dashboard" && (
            <div className="space-y-5">
              {/* Channel Profile & Bio Editor Card */}
              <div className="rounded-2xl border border-white/10 bg-[#071120] p-4 light:border-black/10 light:bg-white sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={user?.avatarUrl || "/avatars/avatar.png"}
                      alt=""
                      className="h-14 w-14 rounded-full object-cover ring-2 ring-orange-400/50"
                    />
                    <div>
                      <h2 className="text-base font-black text-white light:text-slate-900 sm:text-lg">
                        {user?.name || "Your Channel"}
                      </h2>
                      <p className="text-xs font-medium text-slate-400 light:text-slate-600">
                        @{user?.handle || "creator"} • {subscriberCount} subscribers • {formatViews(totalViews)} views
                      </p>
                    </div>
                  </div>
                </div>

                {/* Channel Description / Bio Textarea */}
                <div className="mt-4 border-t border-white/10 pt-4 light:border-black/10">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300 light:text-slate-700">
                    Channel Description / Bio
                  </label>
                  <textarea
                    rows={3}
                    value={channelBio}
                    onChange={(e) => setChannelBio(e.target.value)}
                    placeholder="Tell viewers about your channel, content topics, and upload schedule..."
                    className="w-full resize-none rounded-xl border border-white/10 bg-[#060D18] p-3 text-xs text-white caret-orange-400 outline-none focus:border-orange-400/50 light:border-black/10 light:bg-white light:text-slate-900 sm:text-sm"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[11px] text-slate-400 light:text-slate-500">
                      Visible on your public channel profile page (`/u/${user?.handle}`).
                    </p>
                    <button
                      onClick={handleSaveBio}
                      disabled={savingBio}
                      className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
                    >
                      <Save size={14} />
                      {savingBio ? "Saving..." : bioSaved ? "Saved!" : "Save Bio"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Analytics Summary Overview */}
              <ChannelAnalytics
                stats={analytics ? analytics.videos : emptyContentStats}
                trend={analytics ? analytics.trend.videos : []}
                trendAvailable={analytics?.trendAvailable ?? true}
                loading={analyticsLoading}
              />
            </div>
          )}

          {/* PANEL 2: VIDEOS LIBRARY */}
          {activeTab === "videos" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#071120] px-4 py-3 light:border-black/10 light:bg-white">
                <div>
                  <h2 className="text-base font-black text-white light:text-slate-900 sm:text-lg">
                    Videos Library
                  </h2>
                  <p className="text-xs text-slate-400 light:text-slate-600">
                    {videoItems.length} {videoItems.length === 1 ? "video" : "videos"} uploaded
                  </p>
                </div>
                <Link
                  href="/upload?type=video"
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-3.5 py-2 text-xs font-bold text-white shadow transition hover:-translate-y-0.5"
                >
                  <Plus size={14} />
                  Upload Video
                </Link>
              </div>

              {videoItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] py-14 text-center light:border-black/10 light:bg-black/[0.02]">
                  <Film size={36} className="mb-2 text-slate-500" />
                  <p className="font-bold text-white light:text-slate-900 text-sm">
                    No videos uploaded yet
                  </p>
                  <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                    Upload horizontal long-form videos to build your audience.
                  </p>
                  <Link
                    href="/upload?type=video"
                    className="mt-4 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-5 py-2 text-xs font-bold text-white"
                  >
                    Upload Video
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {videoItems.map((video) => (
                    <div
                      key={video.videoId}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#071120] p-3 transition-all hover:border-orange-500/40 light:border-black/10 light:bg-white"
                    >
                      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black/20">
                        {video.thumbnailUrl && (
                          <Image
                            src={video.thumbnailUrl}
                            alt={video.title}
                            fill
                            sizes="300px"
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        )}
                        <span
                          className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                            video.status === "ready"
                              ? "bg-emerald-500/90 text-white shadow"
                              : video.status === "processing"
                              ? "bg-amber-500/90 text-white shadow"
                              : "bg-red-500/90 text-white shadow"
                          }`}
                        >
                          {video.status}
                        </span>
                        {video.visibility && (
                          <span className="absolute top-2 right-2 rounded-full bg-black/60 backdrop-blur-md px-2 py-0.5 text-[9px] font-bold text-white capitalize">
                            {video.visibility}
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 flex-1 min-w-0">
                        <h3 className="line-clamp-2 text-xs font-bold text-white light:text-slate-900 sm:text-sm">
                          {video.title}
                        </h3>
                        <p className="mt-1 text-[11px] font-medium text-slate-400 light:text-slate-600">
                          {video.category || "General"} • {formatViews(video.views || 0)} views • {formatTimeAgo(video.uploadedAt)}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-1.5 border-t border-white/10 pt-2.5 light:border-black/10">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEditing(video)}
                            className="flex items-center gap-1 rounded-lg bg-orange-500/15 px-2.5 py-1 text-xs font-bold text-orange-400 transition hover:bg-orange-500 hover:text-white light:bg-orange-500/10 light:text-orange-600"
                          >
                            <Pencil size={12} />
                            Edit
                          </button>

                          <Link
                            href={`/watch/${video.videoId}`}
                            className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/20 light:bg-black/5 light:text-slate-700"
                          >
                            <ExternalLink size={12} />
                            Watch
                          </Link>
                        </div>

                        {confirmingDeleteId === video.videoId ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(video.videoId)}
                              disabled={deletingId === video.videoId}
                              className="rounded-lg bg-red-500 px-2 py-1 text-[11px] font-bold text-white"
                            >
                              {deletingId === video.videoId ? "..." : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(null)}
                              className="px-1 text-[11px] text-slate-400 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteId(video.videoId)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-500/15 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PANEL 3: SHORTS LIBRARY */}
          {activeTab === "shorts" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#071120] px-4 py-3 light:border-black/10 light:bg-white">
                <div>
                  <h2 className="text-base font-black text-white light:text-slate-900 sm:text-lg">
                    Shorts Library
                  </h2>
                  <p className="text-xs text-slate-400 light:text-slate-600">
                    {shortItems.length} {shortItems.length === 1 ? "short" : "shorts"} posted
                  </p>
                </div>
                <Link
                  href="/upload?type=short"
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-3.5 py-2 text-xs font-bold text-white shadow transition hover:-translate-y-0.5"
                >
                  <Plus size={14} />
                  Upload Short
                </Link>
              </div>

              {shortItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] py-14 text-center light:border-black/10 light:bg-black/[0.02]">
                  <PlaySquare size={36} className="mb-2 text-slate-500" />
                  <p className="font-bold text-white light:text-slate-900 text-sm">
                    No Shorts posted yet
                  </p>
                  <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                    Upload vertical short videos up to 60 seconds.
                  </p>
                  <Link
                    href="/upload?type=short"
                    className="mt-4 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-5 py-2 text-xs font-bold text-white"
                  >
                    Upload Short
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {shortItems.map((short) => (
                    <div
                      key={short.videoId}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#071120] p-2.5 transition-all hover:border-orange-500/40 light:border-black/10 light:bg-white"
                    >
                      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black/20">
                        {short.thumbnailUrl && (
                          <Image
                            src={short.thumbnailUrl}
                            alt={short.title}
                            fill
                            sizes="250px"
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        )}
                        <span
                          className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                            short.status === "ready"
                              ? "bg-emerald-500/90 text-white shadow"
                              : short.status === "processing"
                              ? "bg-amber-500/90 text-white shadow"
                              : "bg-red-500/90 text-white shadow"
                          }`}
                        >
                          {short.status}
                        </span>
                      </div>

                      <div className="mt-2 flex-1 min-w-0">
                        <h3 className="line-clamp-2 text-xs font-bold text-white light:text-slate-900">
                          {short.title}
                        </h3>
                        <p className="mt-0.5 text-[10px] font-medium text-slate-400 light:text-slate-600">
                          {short.category || "Shorts"} • {formatViews(short.views || 0)} views
                        </p>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-1 border-t border-white/10 pt-2 light:border-black/10">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditing(short)}
                            className="flex items-center gap-1 rounded-lg bg-orange-500/15 px-2 py-1 text-[11px] font-bold text-orange-400 transition hover:bg-orange-500 hover:text-white light:bg-orange-500/10 light:text-orange-600"
                          >
                            <Pencil size={11} />
                            Edit
                          </button>

                          <Link
                            href={`/shorts?v=${short.videoId}`}
                            className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:bg-white/20 light:bg-black/5 light:text-slate-700"
                          >
                            <ExternalLink size={11} />
                            Watch
                          </Link>
                        </div>

                        {confirmingDeleteId === short.videoId ? (
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleDelete(short.videoId)}
                              disabled={deletingId === short.videoId}
                              className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(null)}
                              className="px-1 text-[10px] text-slate-400"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteId(short.videoId)}
                            className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-red-500/15 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PANEL 4: DEDICATED EDIT CONTENT SCREEN */}
          {activeTab === "edit" && (
            <div className="rounded-2xl border border-orange-500/30 bg-[#071120] p-4 shadow-xl light:border-orange-500/20 light:bg-white sm:p-6">
              {!editingId || !editValue || !activeEditingVideo ? (
                <div className="py-12 text-center">
                  <Pencil size={36} className="mx-auto mb-3 text-slate-500" />
                  <h3 className="text-base font-bold text-white light:text-slate-900">
                    No Video Selected for Editing
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                    Pick a video or short from your library to edit its title, description, thumbnail, or category.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <button
                      onClick={() => setActiveTab("videos")}
                      className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white"
                    >
                      Go to Videos Library
                    </button>
                    <button
                      onClick={() => setActiveTab("shorts")}
                      className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 light:border-black/10 light:text-slate-700"
                    >
                      Go to Shorts Library
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Edit Screen Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3.5 light:border-black/10">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
                        <Pencil size={18} />
                      </div>
                      <div>
                        <h2 className="text-base font-black text-white light:text-slate-900 sm:text-lg">
                          Edit {editValue.contentType === "short" ? "Short" : "Video"}
                        </h2>
                        <p className="truncate text-xs font-medium text-slate-400 light:text-slate-600 max-w-[300px] sm:max-w-md">
                          {activeEditingVideo.title}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={cancelEditing}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white light:hover:bg-black/10 light:hover:text-slate-900"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Metadata Fields Form */}
                  <VideoMetadataFields
                    value={editValue}
                    onChange={handleEditChange}
                    categories={CATEGORIES}
                    allowContentTypeChange={false}
                    aiGenerating={aiGenerating}
                    onOpenAITitleAssist={() => setAiTitleAssistOpen(true)}
                    aiError={aiError}
                    aiSuggestions={aiSuggestions}
                    thumbnail={{
                      previewUrl: editThumbnailPreview || activeEditingVideo.thumbnailUrl || null,
                      onFileSelected: handleEditThumbnailSelected,
                      busy: editThumbnailBusy,
                      error: editThumbnailError,
                      muxFrames: activeEditingVideo.muxPlaybackId
                        ? [
                            `https://image.mux.com/${activeEditingVideo.muxPlaybackId}/thumbnail.jpg?time=2`,
                            `https://image.mux.com/${activeEditingVideo.muxPlaybackId}/thumbnail.jpg?time=5`,
                            `https://image.mux.com/${activeEditingVideo.muxPlaybackId}/thumbnail.jpg?time=10`,
                            `https://image.mux.com/${activeEditingVideo.muxPlaybackId}/thumbnail.jpg?time=15`,
                          ]
                        : [],
                      selectedMuxThumbnail,
                      onMuxThumbnailSelected: (url) => {
                        setSelectedMuxThumbnail(url);
                        setEditThumbnailPreview(null);
                      },
                    }}
                    tagInput={editTagInput}
                    onTagInputChange={setEditTagInput}
                  />

                  <AITitleAssistModal
                    open={aiTitleAssistOpen}
                    onClose={() => setAiTitleAssistOpen(false)}
                    initialDescription={editValue.description}
                    generating={aiGenerating}
                    error={aiError}
                    suggestions={aiSuggestions}
                    onGenerate={(userDescription) => handleGenerateAI("title", userDescription)}
                    onPick={(pickedTitle) => {
                      handleEditChange("title", pickedTitle);
                      setAiTitleAssistOpen(false);
                    }}
                  />

                  {error && <p className="mt-2 text-xs font-semibold text-red-400">{error}</p>}

                  <div className="flex items-center gap-2.5 border-t border-white/10 pt-4 light:border-black/10">
                    <button
                      onClick={() => handleSave(editingId)}
                      disabled={savingId === editingId}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-5 py-2.5 text-xs font-bold text-white shadow transition hover:scale-[1.01] disabled:opacity-60"
                    >
                      <Check size={15} />
                      {savingId === editingId ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="flex items-center gap-1.5 rounded-xl border border-white/15 px-5 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white light:border-black/15 light:text-slate-700"
                    >
                      <X size={15} />
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PANEL: PROFILE & SETTINGS */}
          {activeTab === "profile" && (
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6 light:border-black/10 light:bg-black/[0.015]">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 light:border-black/10">
                <div>
                  <h3 className="text-lg font-black text-white light:text-slate-900">Profile & Channel Settings</h3>
                  <p className="text-xs text-slate-400 light:text-slate-600">Customize your public channel identity, avatar, handle, and bio.</p>
                </div>
                <Link
                  href="/profile"
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 text-xs font-bold text-slate-900 shadow hover:scale-105 transition"
                >
                  <Pencil size={14} /> Full Profile Editor
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-4 rounded-xl border border-white/10 p-3 light:border-black/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={user?.avatarUrl || "/avatars/avatar.png"} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-orange-400/40" />
                  <div>
                    <p className="text-sm font-bold text-white light:text-slate-900">{user?.name || "Your Name"}</p>
                    <p className="text-xs text-slate-400 light:text-slate-600">@{user?.handle || "handle"}</p>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-white/10 p-3 light:border-black/10">
                  <label className="text-xs font-semibold text-slate-400 light:text-slate-600">Channel Bio / Description</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={channelBio}
                      onChange={(e) => setChannelBio(e.target.value)}
                      placeholder="Tell viewers about your channel..."
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#07111F] px-3 py-1.5 text-xs text-white outline-none focus:border-orange-400/50 light:border-black/10 light:bg-white light:text-slate-900"
                    />
                    <button
                      onClick={handleSaveBio}
                      disabled={savingBio}
                      className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {savingBio ? "Saving..." : bioSaved ? "Saved!" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PANEL 5: REVENUE & KYC */}
          {activeTab === "revenue" && (
            <RevenueSection
              contentLabel="Channel"
              subscriberCount={subscriberCount}
              totalViews={totalViews}
              payoutStatus={payoutStatus}
              loading={payoutLoading}
              onStatusChange={setPayoutStatus}
            />
          )}

          {/* PANEL 6: HOW INPLAYER WORKS */}
          {activeTab === "how-it-works" && <HowInPlayerWorks />}
        </main>
      </div>
    </div>
  );
}
