"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Play, ArrowLeft, Share2, Plus, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import "./RaftaarFilms3DStyles.css";

export default function SeriesDetailContent({ series, episodes }: any) {
  const router = useRouter();
  const { user, signedIn } = useAuthModal();
  const [isFollowing, setIsFollowing] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const cleanHandle = (series?.creatorHandle || "")
    .replace(/^@/, "")
    .trim();

  // Check if current signed-in user is creator of this series
  const isOwner = Boolean(
    signedIn &&
    user &&
    (user.userId === series?.creatorId ||
      (cleanHandle && (user.handle === cleanHandle || user.username === cleanHandle)))
  );

  // If creator themselves clicks avatar: open their Your Channel Raftaar Films studio page
  // If another viewer clicks avatar: open creator's public profile channel
  const creatorProfileUrl = isOwner
    ? "/my-videos?tab=raftaar-films"
    : cleanHandle
    ? `/u/${cleanHandle}`
    : series?.creatorId
    ? `/u/${series.creatorId}`
    : `/raftaar-films?creatorId=${series?.creatorId}`;

  const sortedEpisodes = [...(episodes || [])].sort(
    (a: any, b: any) => (Number(a.episodeNumber) || 0) - (Number(b.episodeNumber) || 0)
  );
  const firstEpisode = sortedEpisodes?.[0];

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  }, []);

  const handleBack = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    router.push("/raftaar-films");
  }, [router]);

  const handleFollow = async () => {
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    showToast(nextState ? "Joined In-Family ❤️" : "Left In-Family");
    try {
      const res = await fetch(`/api/raftaar-films/series/${series.seriesId}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: nextState ? "subscribe" : "unsubscribe" }),
      });
      if (!res.ok) {
        setIsFollowing(!nextState);
      }
    } catch {
      setIsFollowing(!nextState);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: series.title,
        text: series.description,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast("Series link copied to clipboard!");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24 relative select-none">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top duration-200">
          <div className="rounded-full bg-black/90 px-4 py-2 text-xs font-bold text-white border border-orange-500/40 backdrop-blur-md shadow-2xl shadow-orange-500/20">
            {toastMsg}
          </div>
        </div>
      )}

      {/* Sticky Compact Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-2xl border-b border-white/[0.08] px-3 sm:px-6 py-2.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Back button + Series Title + Genre */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back to Raftaar Films"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/[0.12] text-zinc-300 hover:text-white transition-all backdrop-blur-md active:scale-95 shadow-sm shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white truncate max-w-[200px] sm:max-w-md">
                  {series.title}
                </h1>
                {series.genre && (
                  <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 whitespace-nowrap shrink-0">
                    {series.genre}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Small Creator Avatar Only + In-Family / You + Share */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Small Creator Avatar Only */}
            <Link
              href={creatorProfileUrl}
              className="flex items-center gap-2 group cursor-pointer"
              title={
                isOwner
                  ? "Open Your Channel Raftaar Films Studio"
                  : `View ${series.creatorName || "Creator"}'s channel`
              }
            >
              <div className="w-8 h-8 rounded-full overflow-hidden p-0.5 bg-zinc-800 border border-orange-500/50 shadow-sm group-hover:scale-105 group-hover:border-orange-400 transition-all shrink-0">
                <img
                  src={
                    series.creatorAvatarUrl ||
                    series.creatorProfilePic ||
                    "/avatars/avatar.png"
                  }
                  alt={series.creatorName || "Creator"}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== "/avatars/avatar.png") {
                      target.src = "/avatars/avatar.png";
                    }
                  }}
                />
              </div>
              <span className="hidden md:inline text-xs font-semibold text-zinc-300 group-hover:text-orange-300 transition-colors truncate max-w-[120px]">
                {series.creatorName || cleanHandle || "Creator"}
              </span>
            </Link>

            {isOwner ? (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-orange-500/25 text-orange-400 border border-orange-500/35">
                You
              </span>
            ) : (
              <button
                type="button"
                onClick={handleFollow}
                className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full transition-all active:scale-95 cursor-pointer ${
                  isFollowing
                    ? "bg-white/15 text-orange-300 border border-orange-400/40"
                    : "bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black shadow-[0_0_10px_rgba(249,115,22,0.35)]"
                }`}
              >
                {isFollowing ? (
                  <>
                    <Check className="w-3 h-3 stroke-[2.5]" />
                    <span className="hidden sm:inline">In-Family</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    <span>In-Family</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleShare}
              aria-label="Share series"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/[0.12] text-zinc-300 hover:text-white transition-all backdrop-blur-md active:scale-95 shadow-sm cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Area: Starts immediately with Episodes contents */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4">
        {/* Compact Bar with Watch Ep 1 button, creator note, and stats */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Link
              href={creatorProfileUrl}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full overflow-hidden p-0.5 border border-orange-500/40 shrink-0">
                <img
                  src={
                    series.creatorAvatarUrl ||
                    series.creatorProfilePic ||
                    "/avatars/avatar.png"
                  }
                  alt={series.creatorName || "Creator"}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== "/avatars/avatar.png") {
                      target.src = "/avatars/avatar.png";
                    }
                  }}
                />
              </div>
              <span className="text-xs text-zinc-300 font-medium group-hover:text-orange-300 transition-colors">
                by <span className="font-bold text-white">@{cleanHandle || "creator"}</span>
              </span>
            </Link>
            <span className="text-zinc-600">•</span>
            <span className="text-xs text-orange-400 font-bold">
              {sortedEpisodes.length} Episodes
            </span>
            {((Number(series.totalViews) || 0) > 0) && (
              <>
                <span className="text-zinc-600 hidden sm:inline">•</span>
                <span className="text-xs text-zinc-400 hidden sm:inline">
                  🔥 {(Number(series.totalViews) || 0).toLocaleString()} views
                </span>
              </>
            )}
          </div>

          {/* Quick Watch Ep 1 Primary CTA */}
          {firstEpisode && (
            <Link
              href={`/raftaar-films/${series.seriesId}/${firstEpisode.videoId}`}
              className="inline-flex items-center gap-1.5 text-xs font-black px-3.5 py-1.5 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 hover:from-orange-400 hover:to-yellow-300 text-slate-950 shadow-[0_0_15px_rgba(249,115,22,0.4)] transition-all hover:scale-105 active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Watch Episode 1</span>
            </Link>
          )}
        </div>

        {/* Optional Collapsible Synopsis if description exists */}
        {series.description && (
          <div className="mb-4 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-zinc-300">
            <p className={!showFullDesc ? "line-clamp-2" : ""}>
              {series.description}
            </p>
            {series.description.length > 120 && (
              <button
                type="button"
                onClick={() => setShowFullDesc((prev) => !prev)}
                className="text-orange-400 hover:text-orange-300 font-semibold mt-1 text-[11px]"
              >
                {showFullDesc ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {/* EPISODES GRID - Starting from Episode 1 and following */}
        <section aria-label="Series Episodes">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
              <span>Episodes</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-orange-400">
                {sortedEpisodes.length > 0 ? `1 – ${sortedEpisodes.length}` : "0"}
              </span>
            </h2>
            <span className="text-[11px] text-zinc-400">
              Tap any episode to watch
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
            {sortedEpisodes.map((ep: any, index: number) => {
              const epNum = ep.episodeNumber || index + 1;
              const thumbSrc =
                ep.thumbnailUrl ||
                ep.customThumbnailUrl ||
                series.posterUrl ||
                "/placeholder-vertical.svg";
              return (
                <Link
                  key={ep.videoId}
                  href={`/raftaar-films/${series.seriesId}/${ep.videoId}`}
                  className="group relative rounded-2xl overflow-hidden aspect-[9/16] border border-white/10 bg-zinc-900 transition-all rf-card-3d-lux hover:border-orange-500/50"
                >
                  <img
                    src={thumbSrc}
                    alt={ep.title || `Episode ${epNum}`}
                    className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src !== "/placeholder-vertical.svg") {
                        target.src = "/placeholder-vertical.svg";
                      }
                    }}
                  />

                  {/* Gradient Overlay & Details */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-between p-2.5 sm:p-3 pointer-events-none">
                    <div className="flex items-center justify-between">
                      <span className="bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black text-orange-300 border border-white/10 shadow-sm">
                        Ep {epNum}
                      </span>
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 shadow-[0_0_12px_rgba(249,115,22,0.6)]">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-tight drop-shadow">
                        {ep.episodeTitle || ep.title || `Episode ${epNum}`}
                      </h3>
                      <p className="text-[10px] text-zinc-300 mt-0.5 font-medium">
                        {(Number(ep.views || ep.viewCount) || 0).toLocaleString()} views
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}

            {(!sortedEpisodes || sortedEpisodes.length === 0) && (
              <div className="col-span-full text-center py-16 text-zinc-500 bg-white/[0.02] border border-white/5 rounded-2xl">
                No episodes uploaded to this series yet.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
