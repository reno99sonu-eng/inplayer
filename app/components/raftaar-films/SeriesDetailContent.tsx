"use client";

import { useState } from "react";
import Link from "next/link";
import { Play, ChevronLeft, Share2, Plus, Check, Sparkles, Film } from "lucide-react";
import { useRouter } from "next/navigation";
import "./RaftaarFilms3DStyles.css";

export default function SeriesDetailContent({ series, episodes, user }: any) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const sortedEpisodes = [...(episodes || [])].sort(
    (a: any, b: any) => (Number(a.episodeNumber) || 0) - (Number(b.episodeNumber) || 0)
  );
  const firstEpisode = sortedEpisodes?.[0];
  const nextEpisode = firstEpisode;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

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

  const bannerImg =
    series.bannerUrl ||
    series.posterUrl ||
    series.thumbnailUrl ||
    "/placeholder-vertical.svg";

  return (
    <div className="min-h-screen bg-[#07090E] text-white pb-28 relative overflow-x-hidden select-none">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top duration-200">
          <div className="rounded-full bg-black/90 px-4 py-2 text-xs font-bold text-white border border-orange-500/40 backdrop-blur-md shadow-2xl shadow-orange-500/20">
            {toastMsg}
          </div>
        </div>
      )}

      {/* Top Banner & Header - Height & object-top configured so thumbnail is never cut off */}
      <div className="relative w-full h-[52vh] sm:h-[58vh] md:h-[62vh] max-h-[580px] bg-zinc-950 overflow-hidden group">
        <img
          src={bannerImg}
          alt={series.title}
          className="w-full h-full object-cover object-top sm:object-[center_12%] scale-100 transition-transform duration-1000 ease-out group-hover:scale-105"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== "/placeholder-vertical.svg") {
              target.src = "/placeholder-vertical.svg";
            }
          }}
        />

        {/* Top Vignette Protection for Header Controls */}
        <div className="absolute top-0 inset-x-0 h-36 bg-gradient-to-b from-black/90 via-black/45 to-transparent pointer-events-none z-10" />

        {/* Bottom Ambient Glow & Blend */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#07090E] via-[#07090E]/60 to-transparent pointer-events-none z-10" />

        {/* Header Actions */}
        <div className="absolute top-0 w-full pt-[max(1rem,env(safe-area-inset-top,16px))] px-4 sm:px-6 lg:px-8 flex justify-between items-center z-20 max-w-7xl mx-auto inset-x-0">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md flex items-center justify-center border border-white/15 text-white transition-all hover:scale-105 active:scale-95 shadow-xl"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={handleShare}
            className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md flex items-center justify-center border border-white/15 text-white transition-all hover:scale-105 active:scale-95 shadow-xl"
            aria-label="Share series"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Title, Badges & Metadata over Banner Base */}
        <div className="absolute bottom-6 sm:bottom-8 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto inset-x-0 z-20">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 backdrop-blur-md">
              <Film className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-orange-400 font-extrabold tracking-wider uppercase text-[11px] sm:text-xs">
                Raftaar Film Series
              </span>
            </div>
            {series.genre && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-zinc-200 border border-white/10">
                {series.genre}
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black mb-2 text-white drop-shadow-2xl tracking-tight">
            {series.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-zinc-300 font-medium">
            <span className="bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-bold text-orange-300 border border-white/10">
              {sortedEpisodes.length} Episodes
            </span>
            {((Number(series.totalViews) || 0) > 0 || (Number(series.totalLikes) || 0) > 0) && (
              <>
                <span>•</span>
                <span>🔥 {(Number(series.totalViews) || 0).toLocaleString()} views</span>
                <span>•</span>
                <span>❤️ {(Number(series.totalLikes) || 0).toLocaleString()} likes</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area - Responsive for Desktop, Tablet, Mobile & TV */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Creator, Synopsis & Watch Action */}
          <div className="lg:col-span-4 space-y-6">
            {/* Ultra-Luxurious Creator Card with In-Family Button */}
            <div className="p-4 bg-zinc-900/60 rounded-2xl border border-white/10 backdrop-blur-xl shadow-xl flex items-center justify-between gap-3 rf-card-3d-lux">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 p-0.5 border border-orange-500/40 relative flex-shrink-0 shadow-md">
                  <img
                    src={series.creatorAvatarUrl || series.creatorProfilePic || "/avatars/avatar.png"}
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
                <div className="min-w-0">
                  <p className="font-bold text-sm text-white truncate">{series.creatorName || "Creator"}</p>
                  <p className="text-xs text-orange-300/80 truncate">@{series.creatorHandle || "creator"}</p>
                </div>
              </div>

              {/* In-Family Button (Replaces Follow/Subscribe) */}
              <button
                onClick={handleFollow}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-md active:scale-95 ${
                  isFollowing
                    ? "bg-white/15 text-orange-300 border border-orange-400/40"
                    : "bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black shadow-[0_0_15px_rgba(249,115,22,0.4)] hover:brightness-110"
                }`}
              >
                {isFollowing ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>In-Family</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>In-Family</span>
                  </>
                )}
              </button>
            </div>

            {/* Primary Watch Action Button (Ultra-Luxurious 3D) */}
            {nextEpisode && (
              <Link
                href={`/raftaar-films/${series.seriesId}/${nextEpisode.videoId}`}
                className="rf-btn-3d-lux flex items-center justify-center gap-2.5 w-full text-slate-950 py-4 rounded-2xl font-black text-base sm:text-lg transition-transform active:scale-95 shadow-[0_0_30px_rgba(249,115,22,0.45)]"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Watch Episode 1</span>
              </Link>
            )}

            {/* Series Synopsis */}
            <div className="p-5 bg-zinc-900/40 rounded-2xl border border-white/5 backdrop-blur-md">
              <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 mb-2">Synopsis</h3>
              <p className={`text-zinc-300 text-sm leading-relaxed ${!showFullDesc && "line-clamp-4"}`}>
                {series.description || "No description provided."}
              </p>
              {series.description?.length > 180 && (
                <button
                  onClick={() => setShowFullDesc(!showFullDesc)}
                  className="text-orange-400 text-xs font-bold mt-2 hover:text-orange-300 transition-colors"
                >
                  {showFullDesc ? "Read less" : "Read more"}
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Episodes Shelf */}
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">Episodes</h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  {sortedEpisodes.length}
                </span>
              </div>
              <span className="text-xs text-zinc-400">Micro-drama vertical episodes</span>
            </div>

            {/* 3D Episode Grid - Responsive for all screen sizes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {sortedEpisodes.map((ep: any, index: number) => {
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
                      alt={ep.title}
                      className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== "/placeholder-vertical.svg") {
                          target.src = "/placeholder-vertical.svg";
                        }
                      }}
                    />

                    {/* Gradient Overlay & Details */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-between p-3 pointer-events-none">
                      <div className="flex items-center justify-between">
                        <span className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md text-[11px] font-black text-orange-300 border border-white/10">
                          Ep {ep.episodeNumber || index + 1}
                        </span>
                        <div className="w-7 h-7 rounded-full bg-orange-500/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 shadow-lg text-slate-950">
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        </div>
                      </div>

                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-tight drop-shadow">
                          {ep.episodeTitle || ep.title}
                        </h3>
                        <p className="text-[10px] text-zinc-300 mt-1 font-medium">
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
          </div>
        </div>
      </div>
    </div>
  );
}

