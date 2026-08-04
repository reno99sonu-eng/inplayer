"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import { MoreVertical, ExternalLink } from "lucide-react";

const MuxPlayer = nextDynamic(() => import("@mux/mux-player-react"), {
  ssr: false,
});
import { recommendations, type Recommendation } from "../data/recommendations";
import { shorts, type Short } from "../data/shorts";
import ShortsShelf from "./ShortsShelf";
import { useSettings } from "./settings/SettingsProvider";

const HOVER_PREVIEW_DELAY = 400;

interface RecommendationFeedProps {
  realVideos?: Recommendation[];
  realShorts?: Short[];
  view?: "horizontal" | "vertical";
}

// Native Video-Styled Ad Card (blends seamlessly into 4-column feed grid looking just like a video card)
function NativeAdVideoCard({ seed }: { seed: number }) {
  const adTitles = [
    "Upgrade to Ultra HD Streaming with InPlayer Premium",
    "Discover Handcrafted Products on HamMart Storefront",
    "Learn Fullstack AI Development in 30 Days",
    "Smart Home Security Systems - 40% Off Today",
    "Fastest UPI Payments & Instant Cashback Deals",
  ];
  const adBrands = [
    "InPlayer Pro",
    "HamMart Express",
    "TechAcademy",
    "SmartLiving",
    "PayFlex India",
  ];

  const title = adTitles[seed % adTitles.length];
  const brand = adBrands[seed % adBrands.length];
  const poster = `https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80`;

  return (
    <article className="group relative flex flex-col cursor-pointer">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-[#111827] border border-orange-500/20 shadow-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-2 left-2 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-md">
          Ad
        </div>
        <div className="absolute bottom-2 right-2 rounded-md bg-black/80 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-bold text-orange-300 flex items-center gap-1">
          Sponsored <ExternalLink size={10} />
        </div>
      </div>

      <div className="mt-2.5 flex items-start gap-3">
        <div className="h-9 w-9 flex-shrink-0 rounded-full border border-orange-400/40 bg-orange-500/20 flex items-center justify-center text-xs font-black text-orange-400">
          {brand[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="line-clamp-2 text-xs font-bold leading-tight text-white light:text-slate-900 group-hover:text-orange-400">
            {title}
          </h3>
          <p className="mt-1 text-[11px] font-semibold text-orange-400 light:text-orange-600 flex items-center gap-1">
            {brand} • Sponsored
          </p>
        </div>
      </div>
    </article>
  );
}

// Vertical Short Card for Vertical grid view
function ShortCard({ short }: { short: Short }) {
  const cardContent = (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-[#111827] border border-white/10 shadow-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={short.poster}
        alt={short.title || "InPlay short"}
        className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

      {short.videoId && (
        <span className="absolute top-2 left-2 rounded-md bg-orange-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
          New
        </span>
      )}

      <div className="absolute bottom-0 w-full p-3">
        {short.title && (
          <h3 className="line-clamp-2 text-xs font-bold leading-tight text-white">
            {short.title}
          </h3>
        )}
        <p className="mt-1 text-[10px] font-semibold text-orange-300">
          {short.creator}
        </p>
        <p className="text-[10px] text-slate-300">{short.views}</p>
      </div>
    </div>
  );

  if (short.videoId) {
    return (
      <Link href={`/shorts?v=${short.videoId}`} className="group">
        {cardContent}
      </Link>
    );
  }

  return <article className="group">{cardContent}</article>;
}

// Single Homepage Video Card
export function HomeVideoCard({ video }: { video: Recommendation }) {
  const [previewing, setPreviewing] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { playback } = useSettings();

  useEffect(() => {
    setCanHover(
      typeof window !== "undefined" &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches
    );
  }, []);

  useEffect(() => {
    if (canHover || !video.muxPlaybackId || !cardRef.current || playback.dataSaver) return;

    const el = cardRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => setPreviewing(entry.isIntersecting),
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [canHover, video.muxPlaybackId, playback.dataSaver]);

  const startPreview = () => {
    if (!canHover || !video.muxPlaybackId || playback.dataSaver) return;
    hoverTimer.current = setTimeout(() => setPreviewing(true), HOVER_PREVIEW_DELAY);
  };

  const stopPreview = () => {
    if (!canHover) return;
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setPreviewing(false);
  };

  const thumbnail = (
    <div
      ref={cardRef}
      className="relative aspect-video overflow-hidden rounded-2xl bg-[#111827]"
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
    >
      {previewing && video.muxPlaybackId ? (
        <MuxPlayer
          playbackId={video.muxPlaybackId}
          streamType="on-demand"
          muted
          autoPlay
          loop
          playsInline
          aria-label={`Preview of ${video.title}`}
          className="h-full w-full object-cover"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={video.thumbnail}
          alt={video.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}

      {video.duration && (
        <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
          {video.duration}
        </span>
      )}
    </div>
  );

  return (
    <article className="group relative flex flex-col">
      {video.videoId ? (
        <Link href={`/watch?v=${video.videoId}`}>{thumbnail}</Link>
      ) : (
        thumbnail
      )}

      <div className="mt-2.5 flex items-start gap-3">
        {video.avatar ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={video.avatar}
            alt={video.creator}
            className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="h-9 w-9 flex-shrink-0 rounded-full bg-slate-700" />
        )}

        <div className="flex-1 min-w-0">
          <h3 className="line-clamp-2 text-xs font-bold leading-snug text-white light:text-slate-900 group-hover:text-orange-400">
            {video.title}
          </h3>
          <p className="mt-1 text-[11px] font-semibold text-slate-400 light:text-slate-600">
            {video.creator}
          </p>
          <p className="text-[11px] text-slate-400 light:text-slate-600">
            {video.views} • {video.uploaded}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function RecommendationFeed({
  realVideos = [],
  realShorts = [],
  view = "horizontal",
}: RecommendationFeedProps) {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [shuffledShorts, setShuffledShorts] = useState<Short[]>([]);

  useEffect(() => {
    const combined = realVideos.length > 0 ? realVideos : recommendations;
    setItems(combined);

    const shuffledShortsArr = [...shorts];
    for (let i = shuffledShortsArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledShortsArr[i], shuffledShortsArr[j]] = [
        shuffledShortsArr[j],
        shuffledShortsArr[i],
      ];
    }
    setShuffledShorts([...realShorts, ...shuffledShortsArr]);
  }, [realVideos, realShorts]);

  // Feed Grid Structure: 4 videos (Row 1) + 4 videos (Row 2) = 8 videos per block,
  // followed by a Raftaar Shorts shelf!
  const videosPerBlock = 8;
  const videoBatches = Array.from(
    { length: Math.max(1, Math.ceil(items.length / videosPerBlock)) },
    (_, index) => items.slice(index * videosPerBlock, index * videosPerBlock + videosPerBlock)
  );

  const shortsPerShelf = 8;

  if (view === "vertical") {
    return (
      <section className="mx-auto max-w-[1800px] px-4 py-6 lg:py-10 lg:px-8">
        <div className="mb-4 flex items-center gap-2 lg:mb-6 lg:gap-3">
          <span className="text-2xl lg:text-3xl">🔥</span>
          <h2 className="text-2xl lg:text-3xl font-bold text-white light:text-slate-900">
            Vertical
          </h2>
        </div>

        {shuffledShorts.length === 0 ? (
          <p className="text-sm text-slate-400 light:text-slate-600">
            No vertical videos yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 lg:gap-4">
            {shuffledShorts.map((short) => (
              <ShortCard key={short.id} short={short} />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <>
      {videoBatches.map((videos, blockIndex) => {
        const shelfShorts = shuffledShorts.slice(
          blockIndex * shortsPerShelf,
          (blockIndex + 1) * shortsPerShelf
        );

        return (
          <div key={`feed-block-${blockIndex}`}>
            {/* 4 Videos Row 1 + 4 Videos Row 2 (Grid: 4 columns on large screens) */}
            <section className="mx-auto max-w-[1800px] px-4 py-3 lg:px-8">
              <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
                {videos.map((video, idx) => {
                  const globalIdx = blockIndex * videosPerBlock + idx;
                  // Insert a video-styled Ad Card at position 13 or 16
                  const isAdSlot = globalIdx === 13 || globalIdx === 16;

                  return (
                    <div key={video.id || idx}>
                      {isAdSlot ? <NativeAdVideoCard seed={globalIdx} /> : <HomeVideoCard video={video} />}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Raftaar Shorts shelf after 2 video rows (8 videos) */}
            {shelfShorts.length > 0 && <ShortsShelf items={shelfShorts} />}
          </div>
        );
      })}
    </>
  );
}
