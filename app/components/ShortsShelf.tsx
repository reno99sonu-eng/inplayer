"use client";

import Link from "next/link";
import nextDynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { type Short } from "../data/shorts";
import { useSettings } from "./settings/SettingsProvider";
import VideoOptionsMenu from "./watch/VideoOptionsMenu";
import {
  getActivePreviewId,
  requestActivePreview,
  releaseActivePreview,
  subscribeToActivePreview,
} from "./videoPreviewGate";

// Same on-demand Mux player load as HomeVideoCard (RecommendationFeed.tsx)
// — only needed once a preview actually starts, not in the initial bundle.
const MuxPlayer = nextDynamic(() => import("@mux/mux-player-react"), {
  ssr: false,
});

// Matches HomeVideoCard's own delay exactly — see RecommendationFeed.tsx.
const HOVER_PREVIEW_DELAY = 200;

interface ShortsShelfProps {
  items: Short[];
  renderFooter?: (short: Short) => ReactNode;
}

// Hover (mouse) / scroll-into-view (touch) muted preview for one Raftaar
// shelf card — this is the same shared-slot pattern HomeVideoCard already
// uses for regular 16:9 video cards (see videoPreviewGate.ts), just applied
// to this shelf's cards too. Before this, Raftaar cards were the only ones
// on the homepage that never previewed at all — a static poster no matter
// how long a visitor hovered or how long it sat in view. Sharing the same
// app-wide gate also means a Raftaar card and a regular video card can
// never both be streaming a preview at once.
function ShortsShelfCard({ short, footer }: { short: Short; footer: ReactNode }) {
  const [cardId] = useState<symbol>(() => Symbol(short.id));
  const [canHover, setCanHover] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { playback } = useSettings();

  const [activePreviewId, setActivePreviewId] = useState<symbol | null>(
    () => getActivePreviewId()
  );
  useEffect(() => subscribeToActivePreview(setActivePreviewId), []);
  const previewing = activePreviewId === cardId;

  useEffect(() => {
    return () => releaseActivePreview(cardId);
  }, [cardId]);

  useEffect(() => {
    (() => {
      setCanHover(
        typeof window !== "undefined" &&
          window.matchMedia("(hover: hover) and (pointer: fine)").matches
      );
    })();
  }, []);

  // Touch-device equivalent of hover — autoplays the muted preview once the
  // card is significantly scrolled into view, same as HomeVideoCard's own
  // IntersectionObserver effect (RecommendationFeed.tsx) and for the same
  // reasons: debounced against fast flick-scrolling, skipped entirely when
  // Data Saver is on, and only wired up on devices that can't hover at all
  // so this never fights the mouse-hover path below.
  useEffect(() => {
    if (canHover || !short.muxPlaybackId || !cardRef.current || playback.dataSaver) return;

    const el = cardRef.current;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        if (entry.isIntersecting) {
          debounceTimer = setTimeout(() => requestActivePreview(cardId), HOVER_PREVIEW_DELAY);
        } else {
          releaseActivePreview(cardId);
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      observer.disconnect();
      releaseActivePreview(cardId);
    };
  }, [canHover, short.muxPlaybackId, playback.dataSaver, cardId]);

  const startPreview = () => {
    if (!canHover || !short.muxPlaybackId || playback.dataSaver) return;
    hoverTimer.current = setTimeout(() => requestActivePreview(cardId), HOVER_PREVIEW_DELAY);
  };

  const stopPreview = () => {
    if (!canHover) return;
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    releaseActivePreview(cardId);
  };

  const cardContent = (
    <div
      ref={cardRef}
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      className="relative aspect-[9/16] w-full min-w-[120px] max-w-[220px] mx-auto overflow-hidden rounded-2xl bg-black/40 border border-white/10 shadow-lg"
    >
      {/* Crisp 9:16 vertical poster without haze or stretching */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={short.poster}
        alt={short.title || "Raftaar Short"}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105 transition-opacity ${
          previewing ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Silent, no-controls preview clip — same convention as
          HomeVideoCard's preview (RecommendationFeed.tsx): never plays
          sound, never captures clicks, so the card's click-through to
          /shorts still works normally while a preview is showing. */}
      {previewing && short.muxPlaybackId && (
        <div className="preview-player pointer-events-none absolute inset-0">
          <MuxPlayer
            playbackId={short.muxPlaybackId}
            streamType="on-demand"
            autoPlay="muted"
            muted
            loop
            thumbnailTime={0}
            defaultHiddenCaptions={true}
            preload="auto"
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/10 group-hover:opacity-100">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/80 backdrop-blur-md text-white shadow-lg">
          <div className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-white" />
        </div>
      </div>

      {short.videoId && (
        <span className="absolute top-2 left-2 rounded-md bg-orange-500/90 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-sm">
          New
        </span>
      )}

      {/* Title, creator, and views inside vertical card */}
      <div className="absolute bottom-0 w-full p-2.5">
        {short.title && (
          <h3 className="line-clamp-2 text-xs font-bold leading-snug text-white drop-shadow-md">
            {short.title}
          </h3>
        )}
        <p className="mt-1 text-[10px] font-bold text-orange-400 truncate drop-shadow-sm">
          {short.creator}
        </p>
        <p className="text-[10px] font-semibold text-slate-300 drop-shadow-sm">
          {[short.views, short.likes, short.comments].filter(Boolean).join(" • ")}
        </p>
      </div>
    </div>
  );

  if (short.videoId) {
    return (
      <div className="group relative">
        <Link href={`/shorts?v=${short.videoId}`} prefetch={false}>{cardContent}</Link>
        {/* Raftaar cards had no "More options" menu at all before this —
            a sibling of the Link (not nested inside it), so opening the
            menu never also triggers the card's own navigation. Same
            shared VideoOptionsMenu as regular video cards, which is what
            gives Raftaar the same real Interested/Not Interested, Watch
            Later, Save, and Report actions everywhere else on the
            platform already has. */}
        <div className="absolute top-2 right-2 z-10">
          <VideoOptionsMenu videoId={short.videoId} />
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className="group">
      {cardContent}
      {footer}
    </div>
  );
}

export default function ShortsShelf({ items, renderFooter }: ShortsShelfProps) {
  return (
    <section className="mx-auto max-w-[1800px] px-3 py-1 lg:px-8 lg:py-1.5">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-lg sm:text-xl">🔥</span>
        <h2 className="text-base font-black text-white sm:text-lg light:text-slate-900">
          Raftaar
        </h2>
      </div>

      {/* ONE single horizontally-scrollable row, on every screen size — a
          YouTube-style Shorts shelf, not a wrapping grid. (A previous
          version of this tried a 4-column wrapping grid here, which is NOT
          what was actually wanted and broke the row into an inconsistent
          multi-row stack — reverted.) shortsPerShelf still caps each shelf
          at 8 items (see RecommendationFeed.tsx): once one shelf's 8 slots
          are full, the next 8 shorts start their own new shelf row after
          the next block of regular videos, and so on — that scheduling is
          unchanged, only the layout within a single shelf is. */}
      <div
        className="
          flex
          gap-3
          overflow-x-auto
          pb-2
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {items.map((short) => (
          <ShortsShelfCard key={short.id} short={short} footer={renderFooter?.(short)} />
        ))}
      </div>
    </section>
  );
}
