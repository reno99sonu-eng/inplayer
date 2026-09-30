"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
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
  Play,
  Pause,
  ListVideo,
  X,
  Volume2,
  VolumeX,
  ChevronDown,
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
  const { user, signedIn, openSignIn } = useAuthModal();
  const playerRef = useRef<MuxPlayerRefAttributes | null>(null);

  // Clean creator handle (strips @ if present)
  const cleanHandle = (series?.creatorHandle || "")
    .replace(/^@/, "")
    .trim();

  // Check if the current signed-in user is the creator of this series
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

  // Guarantee episodes are strictly sorted by episodeNumber
  const sortedEpisodes = useMemo(() => {
    if (!episodes || !Array.isArray(episodes)) return [];
    return [...episodes].sort(
      (a: any, b: any) =>
        (Number(a.episodeNumber) || 0) - (Number(b.episodeNumber) || 0)
    );
  }, [episodes]);

  // Find current index
  const currentIndex = useMemo(() => {
    const idx = sortedEpisodes.findIndex(
      (ep: any) => ep.videoId === currentEpisodeId
    );
    return idx >= 0 ? idx : 0;
  }, [sortedEpisodes, currentEpisodeId]);

  const currentEpisode = sortedEpisodes[currentIndex] || sortedEpisodes[0];
  const prevEpisode = currentIndex > 0 ? sortedEpisodes[currentIndex - 1] : null;
  const nextEpisode =
    currentIndex < sortedEpisodes.length - 1
      ? sortedEpisodes[currentIndex + 1]
      : null;

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

  const centerIconTimerRef = useRef<NodeJS.Timeout | null>(null);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);
  const isWheelLockedRef = useRef<boolean>(false);

  // Touch tracking for Reels vertical swipe
  const touchStartYRef = useRef<number>(0);
  const touchStartXRef = useRef<number>(0);
  const touchStartTimeRef = useRef<number>(0);

  // Double-tap to like floating hearts
  const [floatingHearts, setFloatingHearts] = useState<
    Array<{ id: number; x: number; y: number }>
  >([]);

  const posterImage =
    currentEpisode?.thumbnailUrl ||
    currentEpisode?.customThumbnailUrl ||
    series?.posterUrl ||
    "/placeholder-vertical.svg";

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // Sync state on episode change
  useEffect(() => {
    setIsPlaying(true);
    setProgress(0);
    setShowCenterIcon(false);

    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }

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
      // Check series subscription (In-Family)
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

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      if (centerIconTimerRef.current) clearTimeout(centerIconTimerRef.current);
    };
  }, []);

  // Back Navigation handler - Always navigates to Series Detail or Raftaar Films Explore
  const handleBack = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (series?.seriesId) {
      router.push(`/raftaar-films/${series.seriesId}`);
    } else {
      router.push("/raftaar-films");
    }
  }, [series?.seriesId, router]);

  // Navigation handlers
  const goToNext = useCallback(() => {
    if (nextEpisode) {
      router.push(`/raftaar-films/${series.seriesId}/${nextEpisode.videoId}`);
    } else {
      showToast("You're on the latest episode 🎉");
    }
  }, [nextEpisode, series?.seriesId, router, showToast]);

  const goToPrev = useCallback(() => {
    if (prevEpisode) {
      router.push(`/raftaar-films/${series.seriesId}/${prevEpisode.videoId}`);
    } else {
      showToast("This is the first episode 🎬");
    }
  }, [prevEpisode, series?.seriesId, router, showToast]);

  // Play / Pause toggle with zero flickering
  const togglePlay = useCallback(() => {
    const el = playerRef.current;
    if (el) {
      if (el.paused) {
        el.play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      } else {
        el.pause();
        setIsPlaying(false);
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
    setShowCenterIcon(true);
    if (centerIconTimerRef.current) clearTimeout(centerIconTimerRef.current);
    centerIconTimerRef.current = setTimeout(() => setShowCenterIcon(false), 750);
  }, []);

  // Sound & Mute handler
  const toggleMute = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (playerRef.current) {
      playerRef.current.muted = nextMuted;
      if (!nextMuted) {
        playerRef.current.volume = 1;
        if (playerRef.current.paused) {
          playerRef.current.play().catch(() => {});
        }
      }
    }
    showToast(nextMuted ? "Sound Muted 🔇" : "Sound Unmuted 🔊");
  }, [isMuted, showToast]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        toggleMute();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleBack();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrev, goToNext, togglePlay, toggleMute, handleBack]);

  // Like handler
  const handleLike = useCallback(async () => {
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
  }, [currentEpisode?.videoId, signedIn, openSignIn, isLiked]);

  // Central gesture handling (prevents conflict with MuxPlayer native click)
  const handleVideoStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input")) {
      return;
    }

    const now = Date.now();
    const diff = now - lastTapRef.current;

    if (diff < 320) {
      // DOUBLE TAP: Cancel single-tap timeout and trigger double-tap heart pop
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = 0;

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
      // SINGLE TAP: Debounced play/pause toggle
      lastTapRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {
        togglePlay();
        singleTapTimerRef.current = null;
      }, 260);
    }
  };

  // Touch handlers for Reels vertical swipe (both up and down)
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target?.closest("button") || target?.closest("a") || target?.closest("input")) {
      return;
    }
    touchStartYRef.current = e.touches[0].clientY;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartTimeRef.current = Date.now();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (showComments || showEpisodesList) return;

    const target = e.target as HTMLElement;
    if (target?.closest("button") || target?.closest("a") || target?.closest("input")) {
      return;
    }

    const deltaY = touchStartYRef.current - e.changedTouches[0].clientY;
    const deltaX = Math.abs(touchStartXRef.current - e.changedTouches[0].clientX);
    const duration = Date.now() - touchStartTimeRef.current;

    // Minimum swipe threshold: 30px vertical, predominantly vertical, within 900ms
    if (Math.abs(deltaY) > 30 && Math.abs(deltaY) > deltaX * 1.1 && duration < 900) {
      if (deltaY > 0) {
        // Swiped UP -> Next Episode
        goToNext();
      } else {
        // Swiped DOWN -> Previous Episode
        goToPrev();
      }
    }
  };

  // Mouse wheel handler for desktop Reels scrolling
  const handleWheel = (e: React.WheelEvent) => {
    if (showComments || showEpisodesList) return;
    if (isWheelLockedRef.current) return;

    if (e.deltaY > 20) {
      isWheelLockedRef.current = true;
      goToNext();
      setTimeout(() => {
        isWheelLockedRef.current = false;
      }, 600);
    } else if (e.deltaY < -20) {
      isWheelLockedRef.current = true;
      goToPrev();
      setTimeout(() => {
        isWheelLockedRef.current = false;
      }, 600);
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

  // Follow / In-Family Subscription handler
  const handleFollow = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!signedIn) {
      openSignIn();
      return;
    }
    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);
    showToast(nextFollowing ? "Joined In-Family ❤️" : "Left In-Family");

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
      console.error("Failed to toggle In-Family status:", e);
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

  if (!currentEpisode) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <h2 className="text-xl font-bold mb-2">Episode not found</h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20 transition cursor-pointer"
          >
            ← Go Back
          </button>
          <Link
            href={
              series?.seriesId
                ? `/raftaar-films/${series.seriesId}`
                : "/raftaar-films"
            }
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
      {/* Ambient 3D blurred dual-layer glow backdrop for desktop & TV */}
      <div
        className="pointer-events-none absolute inset-0 hidden md:block opacity-35 filter blur-[120px] transform scale-110"
        style={{
          backgroundImage: `url(${posterImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="pointer-events-none absolute inset-0 hidden md:block bg-radial-gradient from-transparent via-[#050914]/80 to-[#050914]" />

      {/* Main vertical player shell (9:16 reels-style container) */}
      <div
        className="fixed inset-0 md:relative w-full h-[100dvh] md:h-[94vh] md:max-w-[460px] md:max-h-[920px] 2xl:max-w-[540px] 2xl:max-h-[1020px] md:rounded-3xl md:overflow-hidden md:border md:border-white/15 md:shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_50px_rgba(255,122,24,0.15)] bg-black flex flex-col overflow-hidden"
        style={{
          overscrollBehaviorY: "none",
          touchAction: "pan-x",
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {/* Video Stage & Gesture Interceptor */}
        <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
          {hasPlaybackSource ? (
            <div className="h-full w-full relative">
              {/* Native MuxPlayer with pointer-events-none so custom single/double tap controls gestures cleanly */}
              <div className="h-full w-full pointer-events-none">
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
                  style={
                    {
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      "--media-object-fit": "cover",
                      "--media-object-position": "center center",
                    } as MuxCSSProperties
                  }
                  onTimeUpdate={(e) => {
                    const el = e.target as HTMLMediaElement;
                    if (el?.currentTime && el?.duration) {
                      setProgress((el.currentTime / el.duration) * 100);
                    }
                  }}
                  onVolumeChange={(e) => {
                    const el = e.target as HTMLMediaElement;
                    if (el) {
                      setIsMuted(el.muted || el.volume === 0);
                    }
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={goToNext}
                />
              </div>

              {/* Transparent Gesture Overlay (Prevents play/pause flickering from Mux native clicks) */}
              <div
                className="absolute inset-0 z-10 cursor-pointer"
                onClick={handleVideoStageClick}
                aria-label="Tap to play/pause, double tap to like"
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
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goToNext();
                    }}
                    className="mt-2 rounded-xl rf-btn-3d-lux px-4 py-2 text-xs font-bold text-white hover:brightness-110 transition cursor-pointer"
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
              className="fill-red-500 text-white drop-shadow-[0_0_25px_rgba(239,68,68,0.9)]"
            />
          </div>
        ))}

        {/* Play/Pause Pulse Icon */}
        {showCenterIcon && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-in fade-in zoom-in-75 duration-200">
            <div className="h-16 w-16 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl">
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
            <div className="rounded-full bg-black/85 px-4 py-1.5 text-xs font-bold text-white border border-orange-500/40 backdrop-blur-md shadow-2xl shadow-orange-500/25">
              {toastMessage}
            </div>
          </div>
        )}

        {/* Top Header - Stop propagation on touches so header buttons never trigger vertical swipe */}
        <div
          className="absolute top-0 w-full pt-[max(1rem,env(safe-area-inset-top,16px))] px-4 pb-3 flex items-center justify-between z-30 bg-gradient-to-b from-black/85 via-black/40 to-transparent"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Back Button - Goes to Series Detail or Raftaar Films Explore */}
          <button
            type="button"
            onClick={handleBack}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 border border-white/20 text-white backdrop-blur-md hover:bg-white/20 hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer z-40"
            aria-label="Back to series"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Episode selector trigger */}
          <button
            type="button"
            onClick={() => setShowEpisodesList(true)}
            className="flex flex-col items-center flex-1 mx-3 min-w-0 cursor-pointer"
          >
            <span className="text-xs font-bold opacity-90 line-clamp-1 drop-shadow-md text-slate-100">
              {series.title}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold bg-black/55 border border-amber-500/35 px-3 py-0.5 rounded-full mt-0.5 backdrop-blur-md text-amber-300 hover:border-amber-400/70 hover:shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all">
              <ListVideo size={13} />
              <span>
                Ep {currentEpisode.episodeNumber || currentIndex + 1} /{" "}
                {sortedEpisodes.length || 1}
              </span>
              <ChevronDown size={12} />
            </div>
          </button>

          {/* Mute / Unmute Toggle */}
          <button
            type="button"
            onClick={toggleMute}
            className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer z-40 ${
              isMuted
                ? "bg-red-500/25 border-red-500/50 text-red-300"
                : "bg-black/55 border-white/20 text-white hover:bg-white/20"
            }`}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {/* Right Action Rail (3D luxury glass buttons) */}
        <div
          className="absolute right-3.5 bottom-28 flex flex-col items-center gap-4 z-30"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Like Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={handleLike}
              className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-xl border transition-all duration-200 hover:scale-110 active:scale-90 shadow-xl cursor-pointer ${
                isLiked
                  ? "bg-red-500/30 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                  : "bg-black/45 border-white/20 text-white hover:border-white/40 shadow-black/80"
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
              type="button"
              onClick={() => setShowComments(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 border border-white/20 text-white backdrop-blur-xl hover:border-amber-400/60 hover:scale-110 active:scale-90 transition-all duration-200 shadow-xl shadow-black/80 cursor-pointer"
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
              type="button"
              onClick={handleSave}
              className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-xl border transition-all duration-200 hover:scale-110 active:scale-90 shadow-xl cursor-pointer ${
                isSaved
                  ? "bg-amber-500/30 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]"
                  : "bg-black/45 border-white/20 text-white hover:border-white/40 shadow-black/80"
              }`}
              aria-label="Save to watchlist"
            >
              <Bookmark
                size={20}
                className={isSaved ? "fill-current text-amber-400" : ""}
              />
            </button>
            <span className="text-[11px] font-bold drop-shadow-md text-slate-100">
              {isSaved ? "Saved" : "Save"}
            </span>
          </div>

          {/* Share Button */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={handleShare}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 border border-white/20 text-white backdrop-blur-xl hover:border-amber-400/60 hover:scale-110 active:scale-90 transition-all duration-200 shadow-xl shadow-black/80 cursor-pointer"
              aria-label="Share episode"
            >
              <Share2 size={19} />
            </button>
            <span className="text-[11px] font-bold drop-shadow-md text-slate-100">
              Share
            </span>
          </div>
        </div>

        {/* Bottom Info Overlay - Isolated from swipe touches */}
        <div
          className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/75 to-transparent p-4 pb-6 z-20 pointer-events-auto"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Creator Profile Row - With pr-20 constraint so In-Family button NEVER overlaps the right action rail */}
          <div className="flex items-center gap-3 mb-2.5 pr-20 max-w-[calc(100%-60px)]">
            {/* Clickable Creator Avatar: Opens /my-videos?tab=raftaar-films for creator, /u/[username] for viewers */}
            <Link
              href={creatorProfileUrl}
              onClick={(e) => e.stopPropagation()}
              className="relative flex-shrink-0 group/avatar cursor-pointer"
              title={
                isOwner
                  ? "Open Your Channel Raftaar Films Studio"
                  : `View ${series.creatorName || "Creator"}'s channel`
              }
            >
              <div className="h-10 w-10 rounded-full overflow-hidden bg-zinc-800 border-2 border-orange-500/50 p-0.5 shadow-lg shadow-orange-500/20 group-hover/avatar:scale-105 group-hover/avatar:border-orange-400 transition-all">
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

            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Clickable Creator Name */}
                <Link
                  href={creatorProfileUrl}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 hover:text-orange-300 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-bold leading-tight drop-shadow-md truncate text-white">
                    {series.creatorName || "Creator"}
                  </p>
                  {isOwner && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-500/25 text-orange-300 border border-orange-500/40">
                      You
                    </span>
                  )}
                </Link>

                {/* In-Family Button (Safely placed beside name; hidden if viewing own series) */}
                {!isOwner && (
                  <button
                    type="button"
                    onClick={handleFollow}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wide transition-all shadow-md active:scale-95 cursor-pointer ${
                      isFollowing
                        ? "bg-white/20 text-slate-200 border border-white/30 backdrop-blur-md hover:bg-white/30"
                        : "rf-btn-3d-lux text-white shadow-orange-500/40"
                    }`}
                    aria-label={isFollowing ? "Leave In-Family" : "Join In-Family"}
                  >
                    {isFollowing ? (
                      <>
                        <Check size={11} className="text-emerald-400 stroke-[3]" />
                        <span>In-Family</span>
                      </>
                    ) : (
                      <>
                        <Plus size={11} className="stroke-[3]" />
                        <span>In-Family</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Clickable Creator Handle */}
              <Link
                href={creatorProfileUrl}
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] text-orange-200/90 drop-shadow truncate mt-0.5 hover:underline cursor-pointer"
              >
                @{cleanHandle || "creator"}
              </Link>
            </div>
          </div>

          {/* Episode Title & Badge */}
          <div className="pr-16 mb-2">
            <div className="inline-flex items-center gap-1.5 bg-orange-500/25 border border-orange-500/40 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-orange-300 mb-1 shadow-sm">
              <span>
                Episode {currentEpisode.episodeNumber || currentIndex + 1}
              </span>
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
                className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 relative"
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
                    Episodes ({sortedEpisodes.length})
                  </h3>
                  <p className="text-xs text-orange-300 line-clamp-1">
                    {series.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEpisodesList(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:text-white transition cursor-pointer"
                  aria-label="Close episode selector"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Episode list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {sortedEpisodes.map((ep: any, idx: number) => {
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
                          ? "border-orange-500/60 bg-orange-500/15 ring-1 ring-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]"
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
                  type="button"
                  onClick={() => setShowComments(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:text-white transition cursor-pointer"
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
