"use client";

import { useEffect, useState, useRef } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import Image from "next/image";
import Link from "next/link";
import {
  Pencil,
  Trash2,
  Loader2,
  X,
  Check,
  Film,
  PlaySquare,
  HelpCircle,
  ExternalLink,
  Plus,
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

export default function MyVideosPage() {
  const { signedIn, authLoading, openSignIn } = useAuthModal();
  const [videos, setVideos] = useState<MyVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const editPanelRef = useRef<HTMLDivElement>(null);
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

  const [activeTab, setActiveTab] = useState<"videos" | "shorts" | "how-it-works">("videos");
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(true);

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

    setTimeout(() => {
      editPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue(null);
    setSelectedMuxThumbnail(null);
    setAiError(null);
    setAiSuggestions([]);
    setAiTitleAssistOpen(false);
    setError(null);
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
          Sign in to see your channel
        </h2>
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

  const isContentTab = activeTab === "videos" || activeTab === "shorts";
  const tabStats = analytics && isContentTab ? analytics[activeTab] : emptyContentStats;
  const tabTrend = analytics && isContentTab ? analytics.trend[activeTab] : [];
  const totalViews = analytics ? analytics.videos.views + analytics.shorts.views : 0;
  const subscriberCount = analytics?.subscriberCount ?? 0;

  const activeEditingVideo = editingId ? videos.find((v) => v.videoId === editingId) : null;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-white light:text-slate-900 sm:text-3xl">
            Your Channel
          </h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
            Manage your uploaded videos, shorts, analytics, and channel settings.
          </p>
        </div>

        <Link
          href="/upload"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
        >
          <Plus size={18} />
          Create New
        </Link>
      </div>

      {/* Individual Panel Buttons */}
      <div className="mt-8 flex items-center gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => {
            setActiveTab("videos");
            setEditingId(null);
          }}
          className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-bold transition-all duration-300 ${
            activeTab === "videos"
              ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-[0_10px_25px_rgba(255,153,0,.35)] scale-105"
              : "border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 hover:text-white light:border-black/10 light:bg-black/[0.03] light:text-slate-700"
          }`}
        >
          <Film size={18} />
          <span>Videos Panel</span>
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs font-extrabold ${
              activeTab === "videos"
                ? "bg-white/20 text-white"
                : "bg-white/10 text-slate-400 light:bg-black/10 light:text-slate-600"
            }`}
          >
            {videoItems.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("shorts");
            setEditingId(null);
          }}
          className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-bold transition-all duration-300 ${
            activeTab === "shorts"
              ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-[0_10px_25px_rgba(255,153,0,.35)] scale-105"
              : "border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 hover:text-white light:border-black/10 light:bg-black/[0.03] light:text-slate-700"
          }`}
        >
          <PlaySquare size={18} />
          <span>Shorts Panel</span>
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs font-extrabold ${
              activeTab === "shorts"
                ? "bg-white/20 text-white"
                : "bg-white/10 text-slate-400 light:bg-black/10 light:text-slate-600"
            }`}
          >
            {shortItems.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("how-it-works");
            setEditingId(null);
          }}
          className={`flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-bold transition-all duration-300 ${
            activeTab === "how-it-works"
              ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-[0_10px_25px_rgba(255,153,0,.35)] scale-105"
              : "border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 hover:text-white light:border-black/10 light:bg-black/[0.03] light:text-slate-700"
          }`}
        >
          <HelpCircle size={18} />
          <span>How InPlayer Works?</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="mt-6 space-y-6">
        {/* Prominent Edit Panel */}
        {editingId && editValue && activeEditingVideo && (
          <div
            ref={editPanelRef}
            className="rounded-3xl border border-orange-500/40 bg-[#071120] p-6 shadow-2xl light:border-orange-500/30 light:bg-white lg:p-8"
          >
            <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4 light:border-black/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-400">
                  <Pencil size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white light:text-slate-900 sm:text-xl">
                    Edit {editValue.contentType === "short" ? "Short" : "Video"}: {editValue.title}
                  </h2>
                  <p className="text-xs font-medium text-slate-400 light:text-slate-600">
                    Modify title, description, category, thumbnail, visibility, or audience settings.
                  </p>
                </div>
              </div>
              <button
                onClick={cancelEditing}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white light:hover:bg-black/10 light:hover:text-slate-900"
              >
                <X size={20} />
              </button>
            </div>

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

            {error && <p className="mt-4 text-xs font-semibold text-red-400">{error}</p>}

            <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4 light:border-black/10">
              <button
                onClick={() => handleSave(editingId)}
                disabled={savingId === editingId}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-60"
              >
                <Check size={16} />
                {savingId === editingId ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={cancelEditing}
                className="flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white light:border-black/15 light:text-slate-700 light:hover:bg-black/10"
              >
                <X size={16} />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: How InPlayer Works */}
        {activeTab === "how-it-works" && <HowInPlayerWorks />}

        {/* Tab 2: Videos Individual Panel */}
        {activeTab === "videos" && (
          <div className="space-y-6">
            <ChannelAnalytics
              stats={tabStats}
              trend={tabTrend}
              trendAvailable={analytics?.trendAvailable ?? true}
              loading={analyticsLoading}
            />

            <RevenueSection
              contentLabel="Videos"
              subscriberCount={subscriberCount}
              totalViews={totalViews}
              payoutStatus={payoutStatus}
              loading={payoutLoading}
              onStatusChange={setPayoutStatus}
            />

            <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-6 light:border-black/10">
              <div>
                <h2 className="text-xl font-black text-white light:text-slate-900 sm:text-2xl">
                  Videos Library
                </h2>
                <p className="text-xs font-medium text-slate-400 light:text-slate-600 sm:text-sm">
                  {videoItems.length} {videoItems.length === 1 ? "video" : "videos"} uploaded
                </p>
              </div>

              <Link
                href="/upload"
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:-translate-y-0.5 sm:text-sm"
              >
                <Plus size={16} />
                Upload Video
              </Link>
            </div>

            {videoItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center light:border-black/10 light:bg-black/[0.02]">
                <Film size={44} className="mb-3 text-slate-500" />
                <p className="font-bold text-white light:text-slate-900">
                  You haven&apos;t uploaded any videos yet
                </p>
                <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                  Share long-form videos, tutorials, reviews, and podcasts with your audience.
                </p>
                <Link
                  href="/upload"
                  className="mt-4 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-2.5 text-xs font-bold text-white shadow-md"
                >
                  Upload a Video
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {videoItems.map((video) => (
                  <div
                    key={video.videoId}
                    className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#071120] p-4 transition-all duration-300 hover:border-orange-500/40 light:border-black/10 light:bg-white light:shadow-lg"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black/20">
                      {video.thumbnailUrl && (
                        <Image
                          src={video.thumbnailUrl}
                          alt={video.title}
                          fill
                          sizes="400px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      )}
                      <span
                        className={`absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          video.status === "ready"
                            ? "bg-emerald-500/90 text-white shadow-md"
                            : video.status === "processing"
                            ? "bg-amber-500/90 text-white shadow-md"
                            : "bg-red-500/90 text-white shadow-md"
                        }`}
                      >
                        {video.status}
                      </span>
                      {video.visibility && (
                        <span className="absolute top-3 right-3 rounded-full bg-black/65 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-white capitalize">
                          {video.visibility}
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="mt-3 flex-1">
                      <h3 className="line-clamp-2 text-base font-bold text-white light:text-slate-900">
                        {video.title}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-slate-400 light:text-slate-600">
                        {video.category || "General"} • {formatViews(video.views || 0)} views • {formatTimeAgo(video.uploadedAt)}
                      </p>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3 light:border-black/10">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(video)}
                          className="flex items-center gap-1.5 rounded-full bg-orange-500/15 px-3 py-1.5 text-xs font-bold text-orange-400 transition hover:bg-orange-500 hover:text-white light:bg-orange-500/10 light:text-orange-600"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>

                        <Link
                          href={`/watch/${video.videoId}`}
                          className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/20 light:bg-black/5 light:text-slate-700 light:hover:bg-black/10"
                        >
                          <ExternalLink size={14} />
                          Watch
                        </Link>
                      </div>

                      {confirmingDeleteId === video.videoId ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(video.videoId)}
                            disabled={deletingId === video.videoId}
                            className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white shadow transition hover:bg-red-600 disabled:opacity-60"
                          >
                            {deletingId === video.videoId ? "..." : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteId(null)}
                            className="rounded-full px-2.5 py-1 text-xs font-semibold text-slate-400 hover:text-white light:hover:text-slate-900"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(video.videoId)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-500/15 hover:text-red-400"
                          title="Delete video"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Shorts Individual Panel */}
        {activeTab === "shorts" && (
          <div className="space-y-6">
            <ChannelAnalytics
              stats={tabStats}
              trend={tabTrend}
              trendAvailable={analytics?.trendAvailable ?? true}
              loading={analyticsLoading}
            />

            <RevenueSection
              contentLabel="Shorts"
              subscriberCount={subscriberCount}
              totalViews={totalViews}
              payoutStatus={payoutStatus}
              loading={payoutLoading}
              onStatusChange={setPayoutStatus}
            />

            <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-6 light:border-black/10">
              <div>
                <h2 className="text-xl font-black text-white light:text-slate-900 sm:text-2xl">
                  Shorts Library
                </h2>
                <p className="text-xs font-medium text-slate-400 light:text-slate-600 sm:text-sm">
                  {shortItems.length} {shortItems.length === 1 ? "short" : "shorts"} posted
                </p>
              </div>

              <Link
                href="/upload"
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:-translate-y-0.5 sm:text-sm"
              >
                <Plus size={16} />
                Upload Short
              </Link>
            </div>

            {shortItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02] py-16 text-center light:border-black/10 light:bg-black/[0.02]">
                <PlaySquare size={44} className="mb-3 text-slate-500" />
                <p className="font-bold text-white light:text-slate-900">
                  You haven&apos;t posted any Shorts yet
                </p>
                <p className="mt-1 text-xs text-slate-400 light:text-slate-600">
                  Share vertical short videos up to 60 seconds with your viewers.
                </p>
                <Link
                  href="/upload"
                  className="mt-4 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-2.5 text-xs font-bold text-white shadow-md"
                >
                  Upload a Short
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {shortItems.map((short) => (
                  <div
                    key={short.videoId}
                    className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#071120] p-3 transition-all duration-300 hover:border-orange-500/40 light:border-black/10 light:bg-white light:shadow-lg"
                  >
                    {/* 9:16 Aspect ratio vertical preview */}
                    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-black/20">
                      {short.thumbnailUrl && (
                        <Image
                          src={short.thumbnailUrl}
                          alt={short.title}
                          fill
                          sizes="300px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      )}
                      <span
                        className={`absolute top-2.5 left-2.5 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                          short.status === "ready"
                            ? "bg-emerald-500/90 text-white shadow-md"
                            : short.status === "processing"
                            ? "bg-amber-500/90 text-white shadow-md"
                            : "bg-red-500/90 text-white shadow-md"
                        }`}
                      >
                        {short.status}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="mt-2.5 flex-1">
                      <h3 className="line-clamp-2 text-xs font-bold text-white light:text-slate-900 sm:text-sm">
                        {short.title}
                      </h3>
                      <p className="mt-1 text-[11px] font-medium text-slate-400 light:text-slate-600">
                        {short.category || "Shorts"} • {formatViews(short.views || 0)} views
                      </p>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-3 flex items-center justify-between gap-1 border-t border-white/10 pt-2.5 light:border-black/10">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditing(short)}
                          className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-bold text-orange-400 transition hover:bg-orange-500 hover:text-white light:bg-orange-500/10 light:text-orange-600"
                        >
                          <Pencil size={12} />
                          Edit
                        </button>

                        <Link
                          href={`/shorts?v=${short.videoId}`}
                          className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/20 light:bg-black/5 light:text-slate-700"
                        >
                          <ExternalLink size={12} />
                          Watch
                        </Link>
                      </div>

                      {confirmingDeleteId === short.videoId ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(short.videoId)}
                            disabled={deletingId === short.videoId}
                            className="rounded-full bg-red-500 px-2 py-1 text-[11px] font-bold text-white shadow transition hover:bg-red-600 disabled:opacity-60"
                          >
                            {deletingId === short.videoId ? "..." : "Yes"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteId(null)}
                            className="rounded-full px-1.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-white"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(short.videoId)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-500/15 hover:text-red-400"
                          title="Delete short"
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
      </div>
    </div>
  );
}
