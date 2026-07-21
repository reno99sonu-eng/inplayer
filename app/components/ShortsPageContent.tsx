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

// Renders caption/description text with #hashtags highlighted, matching
// the convention on every real shorts platform.
function renderWithHashtags(text: string) {
  return text.split(/(#[^\s#]+)/g).map((part, i) =>
    part.startsWith("#") ? (
      <span key={i} className="font-semibold text-sky-300">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
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
  // Try for sound from the very first frame (matches the watch page) —
  // paired with autoPlay="any" below, which attempts unmuted playback
  // first and only falls back to muted if the browser actually blocks it
  // (mobile browsers do this far more often than desktop). The
  // volumechange listener further down keeps this state truthful if that
  // silent fallback happens, so the speaker icon never lies about
  // whether sound is really playing — and a single tap always reliably
  // fixes it either way (see toggleMuted below).
  const [muted, setMuted] = useState(false);
  const [burstIndex, setBurstIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [expandedCaption, setExpandedCaption] = useState<string | number | null>(
    null
  );

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
  // Single/double-tap disambiguation on the video itself, done manually
  // rather than relying on the browser's native "dblclick" event — dblclick
  // is a desktop mouse concept and doesn't fire reliably from two quick
  // taps on real touch devices, which is why double-tap-to-like needs its
  // own timer-based detector to work consistently on mobile too.
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hold-to-fast-forward (press and hold the video → 2× speed, release →
  // back to normal), like YouTube/TikTok. Driven by pointer events so it
  // works with touch on phones/tablets AND with a held mouse button on
  // desktop. The click fired when the finger lifts after a hold is
  // swallowed via suppressClickRef so a hold never also toggles
  // mute/like.
  const [speedBoost, setSpeedBoost] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdPlayerRef = useRef<any>(null);
  const suppressClickRef = useRef(false);

  const startHold = (e: React.PointerEvent<HTMLDivElement>) => {
    // Touch only, per spec ("only for mobile browser version") — matches
    // every other custom gesture on this player; mouse/desktop users
    // already have Mux's own speed control in the settings menu.
    if (e.pointerType !== "touch") return;

    // The overlay div wraps exactly this slide's player — find ITS
    // mux-player element rather than trusting a shared ref.
    const container = e.currentTarget;

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      const playerEl = container.querySelector("mux-player") as any;
      if (playerEl) {
        holdPlayerRef.current = playerEl;
        playerEl.playbackRate = 2;
        setSpeedBoost(true);
      }
    }, 300);
  };

  const endHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdPlayerRef.current) {
      holdPlayerRef.current.playbackRate = 1;
      holdPlayerRef.current = null;
      setSpeedBoost(false);
      // The pointer release that ends a hold also fires a click — swallow
      // it so ending the boost never toggles mute or likes.
      suppressClickRef.current = true;
    }
  };

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

  // Keeps the speaker icon truthful. autoPlay="any" tries unmuted
  // playback first and silently falls back to muted if the browser
  // blocks it (common on mobile) — without this, the icon could keep
  // showing "sound on" even though playback quietly fell back to muted,
  // which is exactly the "no sound but the icon looks fine" confusion
  // reported before. This syncs React state to whatever the player is
  // ACTUALLY doing, whenever that changes for any reason (autoplay
  // fallback, a tap, anything else).
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    function syncMuted() {
      setMuted(player.muted);
    }

    syncMuted();
    player.addEventListener("volumechange", syncMuted);
    return () => player.removeEventListener("volumechange", syncMuted);
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

  // Toggles mute AND imperatively sets it directly on the live player,
  // synchronously, right inside whatever click handler calls this. That's
  // the important part: browsers only actually unlock audible playback
  // when the unmute happens inside a real, direct user gesture. Going
  // through React state alone (setMuted → re-render → prop update on the
  // next tick) is enough of a delay that some browsers keep audio
  // silently suppressed even though the muted prop/icon says "off" —
  // which is exactly the bug where sound only ever worked after clicking
  // mute then unmute (only that second click landed as a genuine
  // in-the-moment gesture).
  const toggleMuted = () => {
    setMuted((m) => {
      const next = !m;
      const player = playerRef.current;
      if (player) {
        player.muted = next;
        if (!next) {
          player.play?.().catch(() => {});
        }
      }
      return next;
    });
  };

  // A tap on the video: always toggles mute immediately (synchronously,
  // see toggleMuted above). If a second tap follows quickly, ALSO treat
  // it as a double-tap (like), same as Instagram/TikTok — mute getting
  // toggled twice during a double-tap is harmless, it just ends back
  // where it started. Works identically for mouse clicks and touch taps
  // since it's driven by the ordinary "click" event, not dblclick.
  const handleVideoTap = (short: Short, index: number) => {
    toggleMuted();

    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      handleDoubleTap(short, index);
      return;
    }

    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
    }, 300);
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
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black px-6 text-center">
        <Clapperboard size={40} className="mb-4 text-slate-600" />
        <p className="font-semibold text-white">No Shorts yet</p>
        <p className="mt-1 text-sm text-slate-400">
          Upload a short to see it appear here.
        </p>
      </div>
    );
  }

  return (
    // Fixed to the viewport (not relying on a calc() offset for the site's
    // navbar/bottom-nav height) so Shorts is a true full-screen immersive
    // view on every device — the old height-calc approach left the site's
    // sticky navbar/category bar visible above the video and made this
    // section fight the page's own scroll, which is what caused the
    // "doesn't fit" and "not smooth" scrolling issues.
    <div className="fixed inset-0 z-[999] overflow-hidden bg-black lg:flex lg:items-center lg:justify-center">
      {/* Ambient blurred backdrop — on wide desktop windows the vertical
          feed column doesn't fill the whole screen (it shouldn't; a
          9:16 video stretched edge-to-edge on a wide monitor would look
          wrong). Rather than leave that space flat black, fill it with a
          heavily blurred wash of the current short's own poster, same
          technique as the watch page's ambient glow — reads as an
          intentional, premium layout instead of empty space. */}
      {shorts[activeIndex]?.poster && (
        <div
          className="pointer-events-none absolute inset-0 hidden lg:block"
          style={{
            backgroundImage: `url(${shorts[activeIndex].poster})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(60px) saturate(1.4) brightness(0.5)",
            opacity: 0.5,
          }}
        />
      )}

      {/* Pinned header — neutral/dark like YouTube's Shorts chrome. Capped
          to the same width as the video column on desktop (see the feed
          container below) so it doesn't span the full, much-wider desktop
          viewport disconnected from the actual video. */}
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

          lg:left-1/2
          lg:right-auto
          lg:w-[480px]
          lg:-translate-x-1/2
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
          onClick={toggleMuted}
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

      {/* Vertical swipeable feed. scroll-behavior:smooth deliberately left
          off — combined with scroll-snap it fights momentum/fling
          scrolling on mobile and was the main cause of janky swipes.
          overscroll-contain stops the rubber-band bounce from leaking to
          the page behind this fixed overlay. */}
      <div
        className="
          mx-auto
          h-full
          w-full
          max-w-[480px]
          snap-y
          snap-mandatory
          overflow-y-scroll
          overscroll-contain
          lg:h-[85vh]
          lg:max-h-[860px]
          lg:rounded-2xl
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

                {/* Single tap toggles mute, a quick second tap likes —
                    see handleVideoTap. Scoped to just this video/poster
                    block (a sibling of the icon-rail buttons below, not a
                    parent), so tapping Like/Comment/Share/Save never also
                    triggers this. */}
                <div
                  className="absolute inset-0 select-none [-webkit-touch-callout:none]"
                  onClick={() => {
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false;
                      return;
                    }
                    handleVideoTap(short, index);
                  }}
                  onPointerDown={startHold}
                  onPointerUp={endHold}
                  onPointerCancel={endHold}
                  onPointerLeave={endHold}
                >
                  {hasRealVideo ? (
                    <div className="shorts-player h-full w-full">
                      <MuxPlayer
                        ref={playerRef}
                        playbackId={short.muxPlaybackId}
                        streamType="on-demand"
                        autoPlay="any"
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
                </div>

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />

                {/* Hold-to-fast-forward badge */}
                {speedBoost && activeIndex === index && (
                  <div className="pointer-events-none absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3.5 py-1.5 text-white backdrop-blur-sm">
                    <span className="text-sm font-black leading-none">2×</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest">
                      Speed
                    </span>
                  </div>
                )}

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
                  {/* Compact by default — one line each, tap to expand the
                      full title/caption. Only this text block opts back
                      into pointer-events (the outer wrapper stays
                      pointer-events-none so it never blocks the tap/like
                      handling on the video above it). */}
                  <div
                    className="pointer-events-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedCaption(
                        expandedCaption === short.id ? null : short.id
                      );
                    }}
                  >
                    {short.title && (
                      <h2
                        className={`text-xs font-black leading-tight text-white lg:text-sm ${
                          expandedCaption === short.id ? "" : "line-clamp-1"
                        }`}
                      >
                        {short.title}
                      </h2>
                    )}

                    {short.description && (
                      <p
                        className={`mt-0.5 text-[11px] text-slate-200 lg:text-xs ${
                          expandedCaption === short.id ? "" : "line-clamp-1"
                        }`}
                      >
                        {renderWithHashtags(short.description)}
                      </p>
                    )}
                  </div>

                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="relative h-6 w-6 overflow-hidden rounded-full ring-2 ring-white/25 lg:h-7 lg:w-7">
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
