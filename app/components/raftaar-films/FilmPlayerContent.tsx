"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import type { MuxPlayerRefAttributes, MuxCSSProperties } from "@mux/mux-player-react";
const MuxPlayer = dynamic(() => import("@mux/mux-player-react"), { ssr: false });

import {
  ChevronLeft,
  Share2,
  Plus,
  Check,
  Heart,
  MessageCircle,
  Bookmark,
  MoreVertical,
  Play,
  Pause,
  ListVideo,
  X,
  Volume2,
  VolumeX,
  ChevronDown,
  Sparkles,
  Loader2,
} from "lucide-react";
import CommentSection from "@/app/components/CommentSection";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import "./RaftaarFilms3DStyles.css";

interface FilmPlayerProps {
  series: any;
  episodes: any[];
  currentEpisodeId: string;
  user?: any;
}

export default function FilmPlayerContent({
  series,
  episodes,
  currentEpisodeId,
}: FilmPlayerProps) {
  const router = useRouter();
  const { signedIn, openSignIn } = useAuthModal();
  const playerRef = useRef<MuxPlayerRefAttributes | null>(null);

  // Find current index
  const currentIndex =
    episodes?.findIndex((ep: any) => ep.videoId === currentEpisodeId) ?? 0;
  const currentEpisode = episodes?.[currentIndex >= 0 ? currentIndex : 0];

  const prevEpisode = currentIndex > 0 ? episodes[currentIndex - 1] : null;
  const nextEpisode =
    currentIndex < (episodes?.length ?? 0) - 1 ? episodes[currentIndex + 1] : null;

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showCenterIcon, setShowCenterIcon] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState<number>(
    currentEpisode?.likeCount || 0
  );
  const [isSaved, setIsSaved] = useState(false);
  const [showEpisodesList, setShowEpisodesList] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const posterImage =
    currentEpisode?.thumbnailUrl ||
    currentEpisode?.customThumbnailUrl ||
    series?.posterUrl ||
    "/placeholder-vertical.svg";

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Fetch likes and subscription on episode change
  useEffect(() => {
    setIsPlaying(true);
    setProgress(0);
    setShowCenterIcon(false);

    if (currentEpisode?.videoId) {
      setLikeCount(currentEpisode.likeCount || 0);

      // Check like status
      (async () => {
        try {
          const session = await fetchAuthSession().catch(() => null);
          const token = session?.tokens?.idToken?.toString();
          const headers: Record<string, string> = {};
          if (token) headers["Authorization"] = `Bearer ${token}`;
          const res = await fetch(`/api/likes?videoId=${currentEpisode.videoId}`, {
            headers,
          });
          if (res.ok) {
            const data = await res.json();
            setIsLiked(data.liked || false);
            if (typeof data.count === "number") setLikeCount(data.count);
          }
        } catch {
          /* ignore */
        }
      })();
    }

    if (series?.seriesId) {
      // Check series subscription
      (async () => {
        try {
          const session = await fetchAuthSession().catch(() => null);
          const token = session?.tokens?.idToken?.toString();
          if (!token) return;
          const res = await fetch(
            `/api/raftaar-films/series/${series.seriesId}/subscribe`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (res.ok) {
            const data = await res.json();
            setIsFollowing(data.subscribed || false);
          }
        } catch {
          /* ignore */
        }
      })();
    }
  }, [currentEpisodeId, currentEpisode?.videoId, series?.seriesId]);

  const goToNext = useCallback(() => {
    if (nextEpisode) {
      router.push(`/raftaar-films/${series.seriesId}/${nextEpisode.videoId}`);
    } else {
      showToast("You're on the latest episode 🎉");
    }
  }, [nextEpisode, series.seriesId, router]);

  const goToPrev = useCallback(() => {
    if (prevEpisode) {
      router.push(`/raftaar-films/${series.seriesId}/${prevEpisode.videoId}`);
    } else {
      showToast("This is the first episode 🎬");
    }
  }, [prevEpisode, series.seriesId, router]);

  // Reels vertical swipe touch handlers
  const touchStartYRef = useRef<number>(0);
  const touchStartXRef = useRef<number>(0);
  const touchStartTimeRef = useRef<number>(0);
  const isWheelLockedRef = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartTimeRef.current = Date.now();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (showComments || showEpisodesList) return;

    const deltaY = touchStartYRef.current - e.changedTouches[0].clientY;
    const deltaX = Math.abs(touchStartXRef.current - e.changedTouches[0].clientX);
    const duration = Date.now() - touchStartTimeRef.current;

    // Minimum swipe threshold: 45px vertical, predominantly vertical, within 700ms
    if (Math.abs(deltaY) > 45 && Math.abs(deltaY) > deltaX * 1.3 && duration < 700) {
      if (deltaY > 0) {
        // Swiped UP -> Next Episode (standard Reels gesture)
        goToNext();
      } else {
        // Swiped DOWN -> Previous Episode (standard Reels gesture)
        goToPrev();
      }
    }
  };

  // Reels mouse wheel handler
  const handleWheel = (e: React.WheelEvent) => {
    if (showComments || showEpisodesList) return;
    if (isWheelLockedRef.current) return;

    if (e.deltaY > 35) {
      isWheelLockedRef.current = true;
      goToNext();
      setTimeout(() => {
        isWheelLockedRef.current = false;
      }, 650);
    } else if (e.deltaY < -35) {
      isWheelLockedRef.current = true;
      goToPrev();
      setTimeout(() => {
        isWheelLockedRef.current = false;
      }, 650);
    }
  };

  // Double-tap to like with floating heart animation
  const [floatingHearts, setFloatingHearts] = useState<
    Array<{ id: number; x: number; y: number }>
  >([]);
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs or textareas
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goToNext();
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrev, goToNext]);

  const togglePlay = () => {
    if (playerRef.current) {
      if (playerRef.current.paused) {
        playerRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        playerRef.current.pause();
        setIsPlaying(false);
      }
      setShowCenterIcon(true);
      setTimeout(() => setShowCenterIcon(false), 900);
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handleVideoEnded = () => {
    goToNext();
  };

  const handleVideoStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input")) {
      return;
    }

    const now = Date.now();
    const diff = now - lastTapRef.current;

    if (diff < 320) {
      // DOUBLE TAP DETECTED!
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = 0;

      // Like video if not already liked
      if (!isLiked) {
        handleLike();
      }

      // Spawn animated heart at tap location
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const heartId = Date.now() + Math.random();

      setFloatingHearts((prev) => [...prev, { id: heartId, x, y }]);
      setTimeout(() => {
        setFloatingHearts((prev) => prev.filter((h) => h.id !== heartId));
      }, 900);
    } else {
      // POSSIBLE SINGLE TAP (play/pause toggle)
      lastTapRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {
        togglePlay();
        singleTapTimerRef.current = null;
      }, 280);
    }
  };

  const handleLike = async () => {
    if (!currentEpisode?.videoId) return;
    if (!signedIn) {
      openSignIn();
      return;
    }
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const session = await fetchAuthSession().catch(() => null);
      const token = session?.tokens?.idToken?.toString();
      if (!token) return;
      await fetch("/api/likes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          videoId: currentEpisode.videoId,
          action: nextLiked ? "like" : "unlike",
        }),
      });
    } catch (e) {
      console.error("Failed to toggle like:", e);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `${series.title} - Ep ${currentEpisode?.episodeNumber || 1}: ${
        currentEpisode?.episodeTitle || currentEpisode?.title || ""
      }`,
      text: `Watch ${series.title} on InPlayer Raftaar Films`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user dismissed */
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        showToast("Link copied to clipboard!");
      } catch {
        /* fallback */
      }
    }
  };

  const handleSave = async () => {
    if (!currentEpisode?.videoId) return;
    if (!signedIn) {
      openSignIn();
      return;
    }
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    showToast(nextSaved ? "Saved to Watchlist" : "Removed from Watchlist");

    try {
      const session = await fetchAuthSession().catch(() => null);
      const token = session?.tokens?.idToken?.toString();
      if (!token) return;
      if (nextSaved) {
        await fetch("/api/watchlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            videoId: currentEpisode.videoId,
            title: currentEpisode.title,
            uploaderName: series.creatorName || "Creator",
            thumbnailUrl: currentEpisode.thumbnailUrl || series.posterUrl,
          }),
        });
      } else {
        await fetch(`/api/watchlist?videoId=${currentEpisode.videoId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (e) {
      console.error("Failed to update watchlist:", e);
    }
  };

  const handleFollow = async () => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);
    showToast(nextFollowing ? `Subscribed to ${series.title}` : `Unsubscribed`);

    try {
      const session = await fetchAuthSession().catch(() => null);
      const token = session?.tokens?.idToken?.toString();
      if (!token) return;
      await fetch(`/api/raftaar-films/series/${series.seriesId}/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: nextFollowing ? "subscribe" : "unsubscribe",
        }),
      });
    } catch (e) {
      console.error("Failed to toggle subscription:", e);
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    if (playerRef.current) {
      const dur = playerRef.current.duration;
      if (dur && isFinite(dur)) {
        playerRef.current.currentTime = dur * pct;
        setProgress(pct * 100);
      }
    }
  };

  const handleBack = () => {
    if (series?.seriesId) {
      router.push(`/raftaar-films/${series.seriesId}`);
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/raftaar-films");
    }
  };

  if (!currentEpisode) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <h2 className="text-xl font-bold mb-2">Episode not found</h2>
        <div className="flex gap-3">
          <button
            onClick={handleBack}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20 transition"
          >
            ← Go Back
          </button>
          <Link
            href={series?.seriesId ? `/raftaar-films/${series.seriesId}` : "/raftaar-films"}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 transition"
          >
            Back to Series
          </Link>
        </div>
      </div>
    );
  }

  const hasPlaybackSource = Boolean(
    currentEpisode.muxPlaybackId || currentEpisode.videoUrl
  );

  return (
    <div className="relative h-[100dvh] w-full bg-[#050914] text-white flex items-center justify-center overflow-hidden select-none">
      {/* Self-contained keyframes for reels double-tap heart pop */}
      <style jsx global>{`
        @keyframes rf-heart-pop {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0) rotate(-15deg);
          }
          20% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.35) rotate(0deg);
          }
          45% {
            transform: translate(-50%, -50%) scale(1.05) rotate(4deg);
          }
          75% {
            opacity: 1;
            transform: translate(-50%, -70px) scale(1.15) rotate(-3deg);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -110px) scale(0.65) rotate(0deg);
          }
        }
        .rf-heart-pop {
          animation: rf-heart-pop 0.85s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>

      {/* Ambient blurred backdrop for desktop screen */}
      <div
        className="pointer-events-none absolute inset-0 hidden md:block opacity-25 filter blur-[110px] transform scale-110"
        style={{
          backgroundImage: `url(${posterImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Main vertical player viewport (9:16 reels-style container) */}
      <div
        className="fixed inset-0 md:relative w-full h-[100dvh] md:h-[94vh] md:max-w-[440px] md:max-h-[880px] md:rounded-3xl md:overflow-hidden md:border md:border-white/10 md:shadow-2xl md:shadow-black/80 bg-black flex flex-col overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {/* Video Stage */}
        <div
          className="absolute inset-0 flex items-center justify-center bg-black cursor-pointer overflow-hidden"
          onClick={handleVideoStageClick}
        >
          {hasPlaybackSource ? (
            <div className="h-full w-full relative">
              <MuxPlayer
                ref={playerRef}
                playbackId={currentEpisode.muxPlaybackId || undefined}
                src={
                  !currentEpisode.muxPlaybackId && currentEpisode.videoUrl
                    ? currentEpisode.videoUrl
                    : undefined
                }
                poster={posterImage}
                streamType="on-demand"
                autoPlay="any"
                playsInline
                loop={false}
                muted={isMuted}
                preload="auto"
                nohotkeys
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  "--media-object-fit": "cover",
                  "--media-object-position": "center center",
                } as MuxCSSProperties}
                onTimeUpdate={(e) => {
                  const el = e.target as HTMLMediaElement;
                  if (el?.currentTime && el?.duration) {
                    setProgress((el.currentTime / el.duration) * 100);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={handleVideoEnded}
              />
            </div>
          ) : (
            <div className="relative w-full h-full flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
              <img
                src={posterImage}
                alt="Episode backdrop"
                className="absolute inset-0 w-full h-full object-cover opacity-20 filter blur-sm"
              />
              <div className="relative z-10 flex flex-col items-center gap-3 max-w-xs">
                <div className="h-14 w-14 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Loader2 size={28} className="animate-spin" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Episode is Processing
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Our video engine is preparing smooth adaptive playback for
                  this episode. It will be ready in just a moment.
                </p>
                {nextEpisode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      goToNext();
                    }}
                    className="mt-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 transition"
                  >
                    Play Next Episode →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Reels Double-Tap Animated Floating Hearts */}
        {floatingHearts.map((heart) => (
          <div
            key={heart.id}
            className="pointer-events-none absolute z-40 rf-heart-pop"
            style={{
              left: `${heart.x}px`,
              top: `${heart.y}px`,
            }}
          >
            <Heart
              size={68}
              className="fill-red-500 text-white drop-shadow-[0_0_24px_rgba(239,68,68,0.85)]"
            />
          </div>
        ))}

        {/* Play/Pause Pulse Icon */}
        {showCenterIcon && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-in fade-in zoom-in-75 duration-200">
            <div className="h-16 w-16 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-xl">
              {isPlaying ? (
                <Play size={28} className="fill-current ml-1" />
              ) : (
                <Pause size={28} className="fill-current" />
              )}
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-top duration-200">
            <div className="rounded-full bg-black/80 px-4 py-1.5 text-xs font-semibold text-white border border-white/15 backdrop-blur-md shadow-xl">
              {toastMessage}
            </div>
          </div>
        )}

        {/* Top Header - with safe area padding to ensure notch/status bar never cuts off header */}
        <div className="absolute top-0 w-full pt-[max(1rem,env(safe-area-inset-top,16px))] px-4 pb-3 flex items-center justify-between z-30 bg-gradient-to-b from-black/85 via-black/40 to-transparent">
          <button
            onClick={handleBack}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 border border-white/10 text-white backdrop-blur-md hover:bg-white/10 transition"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Episode selector trigger */}
          <button
            onClick={() => setShowEpisodesList(true)}
            className="flex flex-col items-center flex-1 mx-3 min-w-0"
          >
            <span className="text-xs font-bold opacity-90 line-clamp-1 drop-shadow-md text-slate-100">
              {series.title}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold bg-black/50 border border-white/15 px-2.5 py-0.5 rounded-full mt-0.5 backdrop-blur-md text-orange-300 hover:border-orange-400/50 transition">
              <ListVideo size={13} />
              <span>
                Ep {currentEpisode.episodeNumber || currentIndex + 1} /{" "}
                {episodes?.length || 1}
              </span>
              <ChevronDown size={12} />
            </div>
          </button>

          {/* Mute Toggle */}
          <button
            onClick={() => setIsMuted((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 border border-white/10 text-white backdrop-blur-md hover:bg-white/10 transition"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {/* Right Action Rail - down arrow removed so Follow button never overlaps */}
        <div className="absolute right-3.5 bottom-28 flex flex-col items-center gap-5 z-30">
          {/* Like Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleLike}
              className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md border transition-all active:scale-90 ${
                isLiked
                  ? "bg-red-500/25 border-red-500 text-red-400"
                  : "bg-black/40 border-white/15 text-white hover:border-white/30"
              }`}
              aria-label="Like episode"
            >
              <Heart
                size={20}
                className={isLiked ? "fill-current text-red-500" : ""}
              />
            </button>
            <span className="text-[11px] font-bold drop-shadow-md text-slate-100">
              {likeCount > 0 ? likeCount : "Like"}
            </span>
          </div>

          {/* Comment Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setShowComments(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 border border-white/15 text-white backdrop-blur-md hover:border-white/30 transition-all active:scale-90"
              aria-label="View comments"
            >
              <MessageCircle size={20} />
            </button>
            <span className="text-[11px] font-bold drop-shadow-md text-slate-100">
              {currentEpisode.commentCount || "Comment"}
            </span>
          </div>

          {/* Save / Bookmark Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleSave}
              className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md border transition-all active:scale-90 ${
                isSaved
                  ? "bg-orange-500/25 border-orange-500 text-orange-400"
                  : "bg-black/40 border-white/15 text-white hover:border-white/30"
              }`}
              aria-label="Save to watchlist"
            >
              <Bookmark
                size={20}
                className={isSaved ? "fill-current text-orange-400" : ""}
              />
            </button>
            <span className="text-[11px] font-bold drop-shadow-md text-slate-100">
              {isSaved ? "Saved" : "Save"}
            </span>
          </div>

          {/* Share Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleShare}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 border border-white/15 text-white backdrop-blur-md hover:border-white/30 transition-all active:scale-90"
              aria-label="Share episode"
            >
              <Share2 size={19} />
            </button>
            <span className="text-[11px] font-bold drop-shadow-md text-slate-100">
              Share
            </span>
          </div>
        </div>

        {/* Bottom Info Overlay */}
        <div className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/70 to-transparent p-4 pb-6 z-20 pointer-events-auto">
          {/* Creator Profile */}
          <div className="flex items-center gap-2.5 mb-2.5">
            <Link
              href={
                series.creatorHandle
                  ? `/u/${series.creatorHandle}`
                  : `/raftaar-films?creatorId=${series.creatorId}`
              }
              className="relative flex-shrink-0"
            >
              <div className="h-9 w-9 rounded-full overflow-hidden bg-zinc-800 border border-orange-500/40 p-0.5">
                <img
                  src={
                    series.creatorAvatarUrl ||
                    series.creatorProfilePic ||
                    "/avatars/avatar.png"
                  }
                  alt={series.creatorName || "Creator"}
                  className="h-full w-full rounded-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== "/avatars/avatar.png") {
                      target.src = "/avatars/avatar.png";
                    }
                  }}
                />
              </div>
            </Link>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold leading-tight drop-shadow-md truncate text-white">
                {series.creatorName || "Creator"}
              </p>
              <p className="text-[10px] text-orange-200/80 drop-shadow truncate">
                @{series.creatorHandle || "creator"}
              </p>
            </div>

            {/* Follow Button */}
            <button
              onClick={handleFollow}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold transition-all shadow ${
                isFollowing
                  ? "bg-white/15 text-slate-200 border border-white/20"
                  : "bg-gradient-to-r from-[#FF7A18] to-[#FF9A00] text-white hover:brightness-110 active:scale-95"
              }`}
            >
              {isFollowing ? (
                <>
                  <Check size={12} />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <Plus size={12} />
                  <span>Follow</span>
                </>
              )}
            </button>
          </div>

          {/* Episode Title & Badge */}
          <div className="pr-16 mb-2">
            <div className="inline-flex items-center gap-1.5 bg-orange-500/25 border border-orange-500/40 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-orange-300 mb-1">
              <span>Episode {currentEpisode.episodeNumber || currentIndex + 1}</span>
              {series.genre && <span>• {series.genre}</span>}
            </div>
            <h2 className="text-sm font-semibold line-clamp-2 drop-shadow-md text-white">
              {currentEpisode.episodeTitle || currentEpisode.title}
            </h2>
          </div>

          {/* Interactive Scrubbable Progress Bar */}
          <div
            onClick={handleProgressBarClick}
            className="w-full h-3 flex items-center cursor-pointer group/progress pt-1"
          >
            <div className="w-full h-1 bg-white/25 rounded-full overflow-hidden relative group-hover/progress:h-1.5 transition-all">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-400 relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-white shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        </div>

        {/* Episodes Drawer / Modal */}
        {showEpisodesList && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200">
            <div className="bg-[#0c1424] border-t border-white/15 h-[68vh] rounded-t-3xl flex flex-col overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-base text-white">
                    Episodes ({episodes?.length || 0})
                  </h3>
                  <p className="text-xs text-orange-300 line-clamp-1">
                    {series.title}
                  </p>
                </div>
                <button
                  onClick={() => setShowEpisodesList(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:text-white transition"
                  aria-label="Close episode selector"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Episode list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {episodes?.map((ep: any, idx: number) => {
                  const isActive = ep.videoId === currentEpisodeId;
                  const epThumb =
                    ep.thumbnailUrl ||
                    ep.customThumbnailUrl ||
                    series.posterUrl ||
                    "/placeholder-vertical.svg";
                  return (
                    <Link
                      key={ep.videoId}
                      href={`/raftaar-films/${series.seriesId}/${ep.videoId}`}
                      onClick={() => setShowEpisodesList(false)}
                      className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all ${
                        isActive
                          ? "border-orange-500/60 bg-orange-500/15 ring-1 ring-orange-500/50"
                          : "border-white/5 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.07]"
                      }`}
                    >
                      <div className="relative aspect-[9/16] w-12 flex-shrink-0 rounded-xl overflow-hidden bg-black/40 border border-white/10">
                        <img
                          src={epThumb}
                          alt={ep.title}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (target.src !== "/placeholder-vertical.svg") {
                              target.src = "/placeholder-vertical.svg";
                            }
                          }}
                        />
                        {isActive && (
                          <div className="absolute inset-0 bg-orange-500/30 flex items-center justify-center">
                            <Play size={14} className="fill-current text-white" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                              isActive
                                ? "bg-orange-500 text-white"
                                : "bg-white/10 text-slate-300"
                            }`}
                          >
                            Ep {ep.episodeNumber || idx + 1}
                          </span>
                          {isActive && (
                            <span className="text-[10px] font-bold text-orange-400">
                              Now Playing
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-xs font-semibold line-clamp-1 ${
                            isActive ? "text-orange-200" : "text-white"
                          }`}
                        >
                          {ep.episodeTitle || ep.title}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {(ep.views || ep.viewCount || 0).toLocaleString()} views
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Comments Drawer / Modal */}
        {showComments && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200">
            <div className="bg-[#0B1526] border-t border-white/15 h-[68vh] rounded-t-3xl flex flex-col overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-base text-white">Comments</h3>
                  <p className="text-xs text-slate-400">
                    Ep {currentEpisode.episodeNumber || currentIndex + 1} •{" "}
                    {currentEpisode.episodeTitle || currentEpisode.title}
                  </p>
                </div>
                <button
                  onClick={() => setShowComments(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:text-white transition"
                  aria-label="Close comments"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <CommentSection videoId={currentEpisode.videoId} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
