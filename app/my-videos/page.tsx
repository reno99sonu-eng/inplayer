"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import Image from "next/image";
import Link from "next/link";
import { Pencil, Trash2, Loader2, X, Check, Film, PlaySquare, HelpCircle } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { formatViews, formatTimeAgo } from "@/app/lib/formatters";
import ChannelAnalytics, { ContentStats } from "@/app/components/analytics/ChannelAnalytics";
import RevenueSection, { PayoutStatus } from "@/app/components/analytics/RevenueSection";
import { TrendPoint } from "@/app/components/analytics/TrendChart";
import HowInPlayerWorks from "@/app/components/HowInPlayerWorks";
import { compressImageToThumbnail } from "@/app/lib/imageCompress";
import VideoMetadataFields, {
  VideoMetadataValue,
  SpokenLanguage,
  Visibility,
} from "@/app/components/VideoMetadataFields";
import { CONTENT_CATEGORIES } from "@/app/data/categories";
import { HomeVideoCard } from "@/app/components/RecommendationFeed";
import ShortsShelf from "@/app/components/ShortsShelf";
import type { Recommendation } from "@/app/data/recommendations";
import type { Short } from "@/app/data/shorts";

// Same source the upload form uses — kept as a local alias so this file
// doesn't need to change at every call site. This used to be its own
// hardcoded (and drifted) list; see app/data/categories.ts for why that's
// now a single shared source of truth.
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
  const { signedIn, authLoading, openSignIn, user } = useAuthModal();
  const [videos, setVideos] = useState<MyVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<VideoMetadataValue | null>(null);
  const [editTagInput, setEditTagInput] = useState("");
  // A newly-picked replacement thumbnail for whichever video is being
  // edited (data URL). Null means "keep the existing thumbnail" — the
  // picker preview then falls back to that video's current thumbnailUrl.
  const [editThumbnailPreview, setEditThumbnailPreview] = useState<string | null>(null);
  const [editThumbnailBusy, setEditThumbnailBusy] = useState(false);
  const [editThumbnailError, setEditThumbnailError] = useState<string | null>(null);
  const [selectedMuxThumbnail, setSelectedMuxThumbnail] = useState<string | null>(null);

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
    });
    setEditTagInput("");
    setEditThumbnailPreview(null);
    setEditThumbnailBusy(false);
    setEditThumbnailError(null);
    setSelectedMuxThumbnail(null);
    setError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue(null);
    setSelectedMuxThumbnail(null);
    setError(null);
  };

  const handleEditChange = <K extends keyof VideoMetadataValue>(
    field: K,
    val: VideoMetadataValue[K]
  ) => {
    setEditValue((prev) => (prev ? { ...prev, [field]: val } : prev));
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
          Sign in to see your videos
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

  const isShort = (v: MyVideo) => v.contentType === "short";
  const filteredVideos = videos.filter((v) =>
    activeTab === "shorts" ? isShort(v) : !isShort(v)
  );
  const isContentTab = activeTab === "videos" || activeTab === "shorts";

  const tabStats = analytics && isContentTab ? analytics[activeTab] : emptyContentStats;
  const tabTrend = analytics && isContentTab ? analytics.trend[activeTab] : [];
  const totalViews = analytics ? analytics.videos.views + analytics.shorts.views : 0;
  const subscriberCount = analytics?.subscriberCount ?? 0;
  const creatorName = user?.name || "You";
  const creatorAvatar = user?.avatarUrl || "/avatars/avatar.png";

  const toRecommendation = (video: MyVideo): Recommendation => ({
    id: video.videoId,
    videoId: video.videoId,
    muxPlaybackId: video.muxPlaybackId,
    title: video.title,
    creator: creatorName,
    avatar: creatorAvatar,
    thumbnail: video.thumbnailUrl || "/recommendations/thumbnails/1.jpg",
    views: `${formatViews(video.views || 0)} views`,
    uploaded: formatTimeAgo(video.uploadedAt),
    duration: "Video",
    uploaderUsername: user?.username,
  });

  const toShort = (video: MyVideo): Short => ({
    id: video.videoId,
    videoId: video.videoId,
    muxPlaybackId: video.muxPlaybackId,
    title: video.title,
    description: video.description,
    creator: creatorName,
    poster: video.thumbnailUrl || "/shorts/1.jpg",
    views: `${formatViews(video.views || 0)} views`,
    likes: "0",
    comments: "0",
    uploaderId: user?.userId,
    uploaderUsername: user?.username,
    uploaderAvatarUrl: user?.avatarUrl || undefined,
  });

  const renderManagementActions = (video: MyVideo) => (
    <div className="mt-3 flex items-center justify-between gap-2">
      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
        video.status === "ready"
          ? "bg-emerald-500/15 text-emerald-400"
          : video.status === "processing"
          ? "bg-amber-500/15 text-amber-400"
          : "bg-red-500/15 text-red-400"
      }`}>
        {video.status}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => startEditing(video)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-white light:hover:bg-black/5 light:hover:text-slate-900" aria-label={`Edit ${video.title}`}>
          <Pencil size={14} />
        </button>
        {confirmingDeleteId === video.videoId ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => handleDelete(video.videoId)} disabled={deletingId === video.videoId} className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-400 disabled:opacity-60">
              {deletingId === video.videoId ? "..." : "Confirm"}
            </button>
            <button type="button" onClick={() => setConfirmingDeleteId(null)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/5 light:hover:bg-black/5">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmingDeleteId(video.videoId)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-500/10 hover:text-red-400" aria-label={`Delete ${video.title}`}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-black text-white light:text-slate-900">
        Your Channel
      </h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
        Manage everything you&apos;ve uploaded to InPlayer.
      </p>

      <div className="mt-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
        {/* Section buttons — left side on larger screens, a pill row on mobile */}
        <div className="flex flex-shrink-0 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:w-48 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:[scrollbar-width:auto] lg:[&::-webkit-scrollbar]:block">
          <button
            onClick={() => setActiveTab("videos")}
            className={`
              flex flex-shrink-0 items-center gap-2.5 rounded-2xl px-4 py-2.5 text-sm font-bold
              transition-all duration-300
              ${
                activeTab === "videos"
                  ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-[0_10px_25px_rgba(255,153,0,.3)]"
                  : "border border-white/10 light:border-black/10 text-slate-300 light:text-slate-700 hover:bg-white/5 light:hover:bg-black/5"
              }
            `}
          >
            <Film size={17} />
            Videos
          </button>
          <button
            onClick={() => setActiveTab("shorts")}
            className={`
              flex flex-shrink-0 items-center gap-2.5 rounded-2xl px-4 py-2.5 text-sm font-bold
              transition-all duration-300
              ${
                activeTab === "shorts"
                  ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-[0_10px_25px_rgba(255,153,0,.3)]"
                  : "border border-white/10 light:border-black/10 text-slate-300 light:text-slate-700 hover:bg-white/5 light:hover:bg-black/5"
              }
            `}
          >
            <PlaySquare size={17} />
            Shorts
          </button>
          <button
            onClick={() => setActiveTab("how-it-works")}
            className={`
              flex flex-shrink-0 items-center gap-2.5 rounded-2xl px-4 py-2.5 text-sm font-bold
              transition-all duration-300
              ${
                activeTab === "how-it-works"
                  ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-[0_10px_25px_rgba(255,153,0,.3)]"
                  : "border border-white/10 light:border-black/10 text-slate-300 light:text-slate-700 hover:bg-white/5 light:hover:bg-black/5"
              }
            `}
          >
            <HelpCircle size={17} />
            How InPlayer Works?
          </button>
        </div>

        {/* Main content for the active section */}
        <div className="min-w-0 flex-1 space-y-6">
          {activeTab === "how-it-works" ? (
            <HowInPlayerWorks />
          ) : (
            <>
              <ChannelAnalytics
                stats={tabStats}
                trend={tabTrend}
                trendAvailable={analytics?.trendAvailable ?? true}
                loading={analyticsLoading}
              />

              <RevenueSection
                contentLabel={activeTab === "shorts" ? "Shorts" : "Videos"}
                subscriberCount={subscriberCount}
                totalViews={totalViews}
                payoutStatus={payoutStatus}
                loading={payoutLoading}
                onStatusChange={setPayoutStatus}
              />

              {filteredVideos.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 light:border-black/10 py-16 text-center">
                  <p className="font-semibold text-white light:text-slate-900">
                    {activeTab === "shorts"
                      ? "You haven't posted any Shorts yet"
                      : "You haven't uploaded any videos yet"}
                  </p>
                  <Link
                    href="/upload"
                    className="mt-4 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-2.5 text-sm font-bold text-white"
                  >
                    Upload {activeTab === "shorts" ? "a Short" : "a video"}
                  </Link>
                </div>
              ) : (
                <>
                  {/* Keep the published channel library visually identical to
                      the home recommendation feed. Editing temporarily
                      restores the existing detailed editor below. */}
                  {!editingId && (
                    activeTab === "shorts" ? (
                      <ShortsShelf
                        items={filteredVideos.map(toShort)}
                        renderFooter={(short) => {
                          const video = filteredVideos.find(
                            (item) => item.videoId === short.videoId
                          );
                          return video ? renderManagementActions(video) : null;
                        }}
                      />
                    ) : (
                      <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredVideos.map((video) => (
                          <div key={video.videoId}>
                            <HomeVideoCard video={toRecommendation(video)} />
                            {renderManagementActions(video)}
                          </div>
                        ))}
                      </div>
                    )
                  )}

                <div className={editingId ? "space-y-3" : "hidden"}>
                  {filteredVideos.map((video) => (
                    <div
                      key={video.videoId}
                      className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] p-4"
                    >
                      {editingId === video.videoId && editValue ? (
                        <div className="space-y-4">
                          <VideoMetadataFields
                            value={editValue}
                            onChange={handleEditChange}
                            categories={CATEGORIES}
                            allowContentTypeChange={false}
                            thumbnail={{
                              previewUrl: editThumbnailPreview || video.thumbnailUrl || null,
                              onFileSelected: handleEditThumbnailSelected,
                              busy: editThumbnailBusy,
                              error: editThumbnailError,
                            
                              muxFrames: video.muxPlaybackId
  ? [
      `https://image.mux.com/${video.muxPlaybackId}/thumbnail.jpg?time=2`,
      `https://image.mux.com/${video.muxPlaybackId}/thumbnail.jpg?time=5`,
      `https://image.mux.com/${video.muxPlaybackId}/thumbnail.jpg?time=10`,
      `https://image.mux.com/${video.muxPlaybackId}/thumbnail.jpg?time=15`,
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

                          {error && <p className="text-xs text-red-400">{error}</p>}

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSave(video.videoId)}
                              disabled={savingId === video.videoId}
                              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                            >
                              <Check size={14} />
                              {savingId === video.videoId ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="flex items-center gap-1.5 rounded-full border border-white/10 light:border-black/10 px-4 py-2 text-xs font-semibold text-slate-300 light:text-slate-700"
                            >
                              <X size={14} />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-4">
                          <div className="relative h-[70px] w-[125px] flex-shrink-0 overflow-hidden rounded-xl bg-white/5 light:bg-black/5">
                            {video.thumbnailUrl && (
                              <Image
                                src={video.thumbnailUrl}
                                alt={video.title}
                                fill
                                sizes="125px"
                                className="object-cover"
                              />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-semibold text-white light:text-slate-900">
                              {video.title}
                            </h3>
                            <p className="text-xs text-slate-400 light:text-slate-600">
                              {video.category} • {formatViews(video.views || 0)} •{" "}
                              {formatTimeAgo(video.uploadedAt)}
                            </p>

                            <span
                              className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                video.status === "ready"
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : video.status === "processing"
                                  ? "bg-amber-500/15 text-amber-400"
                                  : "bg-red-500/15 text-red-400"
                              }`}
                            >
                              {video.status}
                            </span>
                          </div>

                          <div className="flex flex-shrink-0 items-start gap-1">
                            <button
                              onClick={() => startEditing(video)}
                              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/5 light:hover:bg-black/5 hover:text-white light:hover:text-slate-900"
                            >
                              <Pencil size={15} />
                            </button>

                            {confirmingDeleteId === video.videoId ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(video.videoId)}
                                  disabled={deletingId === video.videoId}
                                  className="rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-400 disabled:opacity-60"
                                >
                                  {deletingId === video.videoId ? "..." : "Confirm"}
                                </button>
                                <button
                                  onClick={() => setConfirmingDeleteId(null)}
                                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/5 light:hover:bg-black/5"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmingDeleteId(video.videoId)}
                                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
