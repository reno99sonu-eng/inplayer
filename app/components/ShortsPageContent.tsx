"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import MuxPlayer from "@mux/mux-player-react";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  X,
  Clapperboard,
} from "lucide-react";

import type { Short } from "../data/shorts";
import { useAuthModal } from "./auth/AuthProvider";
import CommentSection from "./CommentSection";

interface ShortsPageContentProps {
  initialShorts: Short[];
}

interface LikeState {
  liked: boolean;
  count: number;
}

interface SubState {
  subscribed: boolean;
  count: number;
}

export default function ShortsPageContent({
  initialShorts,
}: ShortsPageContentProps) {
  const router = useRouter();
  const { signedIn, user, openSignIn } = useAuthModal();

  const shorts = initialShorts;

  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [burstIndex, setBurstIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  const [likeStatus, setLikeStatus] = useState<
    Record<string | number, LikeState>
  >({});
  const [subStatus, setSubStatus] = useState<Record<string, SubState>>({});
  const [savedStatus, setSavedStatus] = useState<
    Record<string | number, boolean>
  >({});
  const [commentCounts, setCommentCounts] = useState<
    Record<string | number, number>
  >({});

  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const index = slideRefs.current.findIndex(
              (el) => el === entry.target
            );
            if (index !== -1) {
              setActiveIndex(index);
              setProgress(0);
            }
          }
        });
      },
      { threshold: [0.6] }
    );

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Sync the progress bar to the actual playing video's real position
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    function handleTimeUpdate() {
      if (player.duration) {
        setProgress((player.currentTime / player.duration) * 100);
      }
    }

    player.addEventListener("timeupdate", handleTimeUpdate);
    return () => player.removeEventListener("timeupdate", handleTimeUpdate);
  }, [activeIndex]);

  // Lazy-load real like / subscribe / save / comment-count status for
  // whichever short is currently active, and cache it so scrolling back
  // to a slide already visited doesn't refetch.
  useEffect(() => {
    const short = shorts[activeIndex];
    if (!short || !short.videoId) return;

    let cancelled = false;

    async function loadStatus() {
      try {
        let headers: HeadersInit = {};

        if (signedIn) {
          const session = await fetchAuthSession();
          const idToken = session.tokens?.idToken?.toString();
          if (idToken) headers = { Authorization: `Bearer ${idToken}` };
        }

        if (!(short.id in likeStatus)) {
          const res = await fetch(`/api/likes?videoId=${short.videoId}`, {
            headers,
          });
          const data = await res.json();
          if (!cancelled) {
            setLikeStatus((prev) => ({
              ...prev,
              [short.id]: {
                liked: data.myReaction === "like",
                count: data.likeCount || 0,
              },
            }));
          }
        }

        if (short.uploaderId && !(short.uploaderId in subStatus)) {
          const res = await fetch(
            `/api/subscriptions?creatorId=${short.uploaderId}`,
            { headers }
          );
          const data = await res.json();
          if (!cancelled) {
            setSubStatus((prev) => ({
              ...prev,
              [short.uploaderId as string]: {
                subscribed: data.isSubscribed || false,
                count: data.subscriberCount || 0,
              },
            }));
          }
        }

        if (!(short.id in savedStatus)) {
          const res = await fetch(`/api/watchlist?videoId=${short.videoId}`, {
            headers,
          });
          const data = await res.json();
          if (!cancelled) {
            setSavedStatus((prev) => ({
              ...prev,
              [short.id]: data.inWatchlist || false,
            }));
          }
        }

        if (!(short.id in commentCounts)) {
          const res = await fetch(`/api/comments?videoId=${short.videoId}`);
          const data = await res.json();
          if (!cancelled) {
            setCommentCounts((prev) => ({
              ...prev,
              [short.id]: (data.comments || []).length,
            }));
          }
        }
      } catch (err) {
        console.error("Failed to load short interaction status:", err);
      }
    }

    loadStatus();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, signedIn, shorts]);

  const handleToggleLike = async (short: Short) => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    if (!short.videoId) return;

    const current = likeStatus[short.id] || { liked: false, count: 0 };
    const nextLiked = !current.liked;
    const nextCount = Math.max(0, current.count + (nextLiked ? 1 : -1));

    setLikeStatus((prev) => ({
      ...prev,
      [short.id]: { liked: nextLiked, count: nextCount },
    }));

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      await fetch("/api/likes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          videoId: short.videoId,
          action: nextLiked ? "like" : "remove",
        }),
      });
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  const handleDoubleTap = (short: Short, index: number) => {
    if (!likeStatus[short.id]?.liked) {
      handleToggleLike(short);
    }
    setBurstIndex(index);
    setTimeout(() => setBurstIndex(null), 800);
  };

  const handleToggleSubscribe = async (short: Short) => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    if (!short.uploaderId || short.uploaderId === user?.userId) return;

    const key = short.uploaderId;
    const wasSubscribed = subStatus[key]?.subscribed || false;
    const nextSubscribed = !wasSubscribed;

    setSubStatus((prev) => {
      const current = prev[key] || { subscribed: false, count: 0 };
      return {
        ...prev,
        [key]: {
          subscribed: nextSubscribed,
          count: Math.max(0, current.count + (nextSubscribed ? 1 : -1)),
        },
      };
    });

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      await fetch("/api/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          creatorId: short.uploaderId,
          action: nextSubscribed ? "subscribe" : "unsubscribe",
        }),
      });
    } catch (err) {
      console.error("Failed to toggle subscription:", err);
    }
  };

  const handleToggleSave = async (short: Short) => {
    if (!signedIn) {
      openSignIn();
      return;
    }
    if (!short.videoId) return;

    const wasSaved = savedStatus[short.id] || false;
    const nextSaved = !wasSaved;
    setSavedStatus((prev) => ({ ...prev, [short.id]: nextSaved }));

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          videoId: short.videoId,
          action: nextSaved ? "add" : "remove",
        }),
      });
    } catch (err) {
      console.error("Failed to toggle save:", err);
    }
  };

  const handleShare = async (short: Short) => {
    if (!short.videoId) return;
    const url = `${window.location.origin}/watch/${short.videoId}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: short.title, url });
        return;
      } catch {
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(short.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  if (shorts.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-5rem)] w-full flex-col items-center justify-center bg-black px-6 text-center lg:h-dvh">
        <Clapperboard size={40} className="mb-4 text-slate-600" />
        <p className="font-semibold text-white">No Shorts yet</p>
        <p className="mt-1 text-sm text-slate-400">
          Upload a short to see it appear here.
        </p>
      </div>
    );
  }

  return (
    <div
      className="
        relative
        h-[calc(100dvh-5rem)]
        w-full
        overflow-hidden
        bg-black

        lg:h-dvh
      "
    >
      {/* Pinned header — neutral/dark like YouTube's Shorts chrome */}
      <div
        className="
          absolute
          top-0
          left-0
          right-0
          z-20
          flex
          items-center
          gap-2.5
          bg-gradient-to-b
          from-black/80
          to-transparent
          px-3
          py-3

          lg:gap-3
          lg:px-4
          lg:py-4
        "
      >
        <button
          onClick={() => router.back()}
          className="
            flex
            h-8
            w-8
            items-center
            justify-center
            rounded-full
            border
            border-white/10
            bg-white/10
            text-white
            backdrop-blur-md
            transition-all
            duration-200
            hover:border-white/30
            hover:bg-white/20

            lg:h-9
            lg:w-9
          "
        >
          <ArrowLeft size={17} />
        </button>

        <h1 className="text-sm font-black text-white lg:text-base">
          Shorts
        </h1>

        <button
          onClick={() => setMuted(!muted)}
          className="
            ml-auto
            flex
            h-8
            w-8
            items-center
            justify-center
            rounded-full
            border
            border-white/10
            bg-white/10
            text-white
            backdrop-blur-md
            transition-all
            duration-200
            hover:border-white/30
            hover:bg-white/20

            lg:h-9
            lg:w-9
          "
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      </div>

      {/* Progress dots — neutral white, not brand orange */}
      <div
        className="
          pointer-events-none
          absolute
          right-2
          top-1/2
          z-20
          hidden
          -translate-y-1/2
          flex-col
          gap-1.5

          sm:flex
        "
      >
        {shorts.map((_, index) => (
          <span
            key={index}
            className={`
              h-1.5
              w-1.5
              rounded-full
              transition-all
              duration-300
              ${
                activeIndex === index
                  ? "scale-125 bg-white shadow-[0_0_8px_rgba(255,255,255,.6)]"
                  : "bg-white/25"
              }
            `}
          />
        ))}
      </div>

      {/* Vertical swipeable feed */}
      <div
        className="
          mx-auto
          h-full
          w-full
          max-w-[480px]
          snap-y
          snap-mandatory
          overflow-y-scroll
          scroll-smooth
          lg:border-x
          lg:border-white/10
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {shorts.map((short, index) => {
          const isActive = activeIndex === index;
          const hasRealVideo = isActive && !!short.muxPlaybackId;

          const like = likeStatus[short.id];
          const isLiked = like?.liked || false;
          const likeCount = like?.count ?? 0;

          const isSaved = savedStatus[short.id] || false;
          const commentCount = commentCounts[short.id] ?? 0;

          const sub = short.uploaderId
            ? subStatus[short.uploaderId]
            : undefined;
          const isSubscribed = sub?.subscribed || false;
          const isOwnChannel =
            signedIn && !!short.uploaderId && user?.userId === short.uploaderId;

          return (
            <div
              key={short.id}
              ref={(el) => {
                slideRefs.current[index] = el;
              }}
              className="
                relative
                flex
                h-full
                w-full
                snap-start
                snap-always
                items-center
                justify-center
              "
            >
              <div
                className={`
                  relative
                  h-full
                  w-full
                  transition-all
                  duration-500
                  ease-out
                  ${
                    isActive
                      ? "scale-100 opacity-100"
                      : "scale-[0.94] opacity-60"
                  }
                `}
                onDoubleClick={() => handleDoubleTap(short, index)}
              >
                {/* Real, synced progress bar */}
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 z-30 h-0.5 bg-white/20">
                    <div
                      className="h-full bg-white transition-[width] duration-100 ease-linear"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                {hasRealVideo ? (
                  <div className="shorts-player h-full w-full">
                    <MuxPlayer
                      ref={playerRef}
                      playbackId={short.muxPlaybackId}
                      streamType="on-demand"
                      autoPlay="muted"
                      loop
                      muted={muted}
                      thumbnailTime={0}
                      style={{ height: "100%", width: "100%" }}
                    />
                  </div>
                ) : (
                  <Image
                    src={short.poster}
                    alt={short.title || "InPlay short"}
                    fill
                    sizes="100vw"
                    priority={index === 0}
                    className="object-cover"
                  />
                )}

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />

                {/* Double-tap heart burst — red, YouTube/Instagram-style */}
                {burstIndex === index && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <Heart
                      size={100}
                      className="animate-heart-burst fill-red-500 text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,.6)]"
                    />
                  </div>
                )}

                <div className="pointer-events-none absolute bottom-6 left-4 right-16 lg:bottom-6">
                  {short.title && (
                    <h2 className="text-sm font-black leading-tight text-white lg:text-base">
                      {short.title}
                    </h2>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative h-7 w-7 overflow-hidden rounded-full ring-2 ring-white/25 lg:h-8 lg:w-8">
                      {/* A plain <img>, not next/image — avatars are
                          base64 data URLs (see app/lib/imageCompress.ts),
                          which next/image doesn't optimize/serve cleanly. */}
                      <img
                        src={short.uploaderAvatarUrl || "/avatars/avatar.png"}
                        alt={short.creator}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <span className="text-xs font-semibold text-white lg:text-sm">
                      {short.creator}
                    </span>

                    {!isOwnChannel && short.uploaderId && (
                      <button
                        onClick={() => handleToggleSubscribe(short)}
                        className={`
                          pointer-events-auto
                          ml-1
                          rounded-full
                          px-3
                          py-1
                          text-[11px]
                          font-bold
                          transition
                          hover:scale-105
                          ${
                            isSubscribed
                              ? "border border-white/25 text-slate-200"
                              : "bg-white text-black"
                          }
                        `}
                      >
                        {isSubscribed ? "Subscribed" : "Subscribe"}
                      </button>
                    )}
                  </div>

                  <p className="mt-1 text-[11px] text-slate-300">
                    {short.views}
                  </p>
                </div>

                {/* Icon rail — neutral chrome, red heart when liked */}
                <div className="absolute bottom-6 right-3 flex flex-col items-center gap-3.5 lg:gap-4">
                  <button
                    onClick={() => handleToggleLike(short)}
                    className="flex flex-col items-center gap-1"
                  >
                    <div
                      className={`
                        flex
                        h-9
                        w-9
                        items-center
                        justify-center
                        rounded-full
                        backdrop-blur-md
                        transition-all
                        duration-200

                        lg:h-10
                        lg:w-10
                        ${
                          isLiked
                            ? "bg-red-500/20"
                            : "bg-white/10 hover:bg-white/20"
                        }
                      `}
                    >
                      <Heart
                        size={19}
                        className={
                          isLiked ? "fill-red-500 text-red-500" : "text-white"
                        }
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-white">
                      {likeCount > 0 ? likeCount : "Like"}
                    </span>
                  </button>

                  <button
                    onClick={() => short.videoId && setCommentsFor(short.videoId)}
                    className="flex flex-col items-center gap-1"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-all duration-200 hover:bg-white/20 lg:h-10 lg:w-10">
                      <MessageCircle size={19} className="text-white" />
                    </div>
                    <span className="text-[10px] font-semibold text-white">
                      {commentCount > 0 ? commentCount : "Comment"}
                    </span>
                  </button>

                  <button
                    onClick={() => handleShare(short)}
                    className="flex flex-col items-center gap-1"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-all duration-200 hover:bg-white/20 lg:h-10 lg:w-10">
                      <Share2 size={19} className="text-white" />
                    </div>
                    <span className="text-[10px] font-semibold text-white">
                      {copiedId === short.id ? "Copied" : "Share"}
                    </span>
                  </button>

                  <button
                    onClick={() => handleToggleSave(short)}
                    className="flex flex-col items-center gap-1"
                  >
                    <div
                      className={`
                        flex
                        h-9
                        w-9
                        items-center
                        justify-center
                        rounded-full
                        backdrop-blur-md
                        transition-all
                        duration-200

                        lg:h-10
                        lg:w-10
                        ${
                          isSaved
                            ? "bg-white/20"
                            : "bg-white/10 hover:bg-white/20"
                        }
                      `}
                    >
                      <Bookmark
                        size={19}
                        className={isSaved ? "fill-white text-white" : "text-white"}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-white">
                      Save
                    </span>
                  </button>

                  {short.videoId && (
                    <Link
                      href={`/watch/${short.videoId}`}
                      className="mt-1 text-[9px] font-semibold text-slate-300 underline underline-offset-2"
                    >
                      Full page
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comment bottom sheet — reuses the real CommentSection component
          used on the watch page, so likes/comments stay one system. */}
      {commentsFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm lg:items-center">
          <div className="relative flex max-h-[75dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0B0F1A] lg:max-h-[80vh] lg:rounded-3xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-bold text-white">Comments</span>
              <button
                onClick={() => setCommentsFor(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto px-4 pb-6">
              <CommentSection videoId={commentsFor} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
