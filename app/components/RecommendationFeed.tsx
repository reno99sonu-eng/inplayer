"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import nextDynamic from "next/dynamic";
import { MoreVertical } from "lucide-react";

// The Mux player (with its whole HLS streaming engine) is one of the
// heaviest pieces of JavaScript in the app. It's only needed here for
// hover/scroll previews — so it's loaded on demand the first time a
// preview actually starts, instead of being bundled into the homepage's
// initial JavaScript. This alone cuts hundreds of KB from what every
// visitor downloads before the homepage becomes interactive.
const MuxPlayer = nextDynamic(() => import("@mux/mux-player-react"), {
  ssr: false,
});
import { recommendations, type Recommendation } from "../data/recommendations";
import { shorts, type Short } from "../data/shorts";
import ShortsShelf from "./ShortsShelf";
import { useSettings } from "./settings/SettingsProvider";

// Hover-preview delay — don't start streaming a preview for every card the
// mouse passes over while scrolling, only once the user actually pauses on
// one (matches YouTube's own hover-preview behavior).
const HOVER_PREVIEW_DELAY = 400;

interface RecommendationFeedProps {
  realVideos?: Recommendation[];
  realShorts?: Short[];
  // "horizontal" (default) renders the normal 16:9 video grid; "vertical"
  // renders a Shorts-only grid. Driven by the Horizontal/Vertical chips in
  // the category bar (see NavigationCategories.tsx / page.tsx).
  view?: "horizontal" | "vertical";
}

// A single vertical (9:16) Shorts card for the Vertical home view. Mirrors
// the ShortsShelf card visual but lays out in a multi-row responsive grid
// instead of a single scrolling row.
function ShortCard({ short }: { short: Short }) {
  const cardContent = (
    <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-[#111827] light:bg-black/5">
      <Image
        src={short.poster}
        alt={short.title || "InPlay short"}
        fill
        sizes="(max-width:640px)45vw,(max-width:1024px)30vw,18vw"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />

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

// A single homepage video card. Owns its own hover-preview state so each
// card starts/stops its preview independently of every other card on the
// page.
export function HomeVideoCard({ video }: { video: Recommendation }) {
  const [previewing, setPreviewing] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { playback } = useSettings();

  // Only real devices with an actual mouse get the hover preview — on
  // touch devices "hover" is either unsupported or fires unreliably on
  // first tap, which would make thumbnails flicker/misbehave.
  useEffect(() => {
    setCanHover(
      typeof window !== "undefined" &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches
    );
  }, []);

  // Touch devices have no hover state at all, so the preview never had a
  // way to trigger on mobile. The mobile equivalent: autoplay the muted
  // preview once the card is significantly scrolled into view, same as
  // Instagram/Facebook video feeds do. Only wired up when the device
  // genuinely can't hover, so this and the mouse-hover behavior above
  // never both fire for the same card. Skipped entirely when Data Saver
  // is on (Settings → Playback) — that's the real, working effect of the
  // toggle: no autoplaying preview clips burning mobile data.
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

  const cardContent = (
    <>
      {/* Thumbnail */}
      <div
        ref={cardRef}
        className="
          relative
          aspect-video
          overflow-hidden
          rounded-2xl
          bg-[#111827]
        "
        onMouseEnter={startPreview}
        onMouseLeave={stopPreview}
      >
        <Image
          src={video.thumbnail}
          alt={video.title}
          fill
          sizes="(max-width:768px)100vw,(max-width:1280px)50vw,25vw"
          className={`
            object-cover
            transition-opacity
            duration-300
            group-hover:scale-[1.05]
            ${previewing ? "opacity-0" : "opacity-100"}
          `}
        />

        {/* Silent, no-controls preview clip — just like YouTube's
            hover-preview, this never plays sound and never captures
            clicks (pointer-events-none) so the card's own click-through
            to the watch page always works normally. */}
        {previewing && video.muxPlaybackId && (
          <div className="preview-player pointer-events-none absolute inset-0">
            <MuxPlayer
              playbackId={video.muxPlaybackId}
              streamType="on-demand"
              autoPlay="muted"
              muted
              loop
              thumbnailTime={0}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

        <span
          className="
            absolute
            bottom-3
            right-3
            rounded-md
            bg-black/85
            px-2
            py-1
            text-xs
            font-semibold
            text-white
            backdrop-blur-sm
          "
        >
          {video.duration}
        </span>

        {video.videoId && (
          <span
            className="
              absolute
              top-3
              left-3
              rounded-md
              bg-orange-500/90
              px-2
              py-0.5
              text-[10px]
              font-bold
              uppercase
              tracking-wide
              text-white
            "
          >
            New
          </span>
        )}
      </div>

      {/* Information */}
      <div className="mt-4 flex items-start gap-3">

        <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-white/10 light:border-black/10">
          {/* A plain <img>, not next/image — real uploaders' avatars are
              base64 data URLs (see app/lib/imageCompress.ts), which
              next/image doesn't optimize/serve cleanly. lazy + async so
              below-the-fold avatars never compete with the visible cards
              for decode/paint time. */}
          <img
            src={video.avatar}
            alt={video.creator}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">

          <h3
            className="
              line-clamp-2
              text-[16px]
              font-semibold
              leading-6
              text-white
              light:text-slate-900
            "
          >
            {video.title}
          </h3>

          <div className="mt-2 flex items-center gap-1 text-sm text-slate-400 light:text-slate-600">
            <span className="truncate">
              {video.creator}
            </span>

            {video.verified && (
              <span className="ml-1 text-xs font-bold text-slate-300 light:text-slate-600">
                ✓
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-slate-500">
            {video.views} • {video.uploaded}
          </p>

        </div>

        <button
          className="
            flex
            h-9
            w-9
            flex-shrink-0
            items-center
            justify-center
            rounded-full
            text-slate-400
            light:text-slate-600
            transition-colors
            hover:bg-white/5
            light:hover:bg-black/5
            hover:text-white
            light:hover:text-slate-900
          "
        >
          <MoreVertical size={18} />
        </button>

      </div>
    </>
  );

  // Real uploaded videos link to their actual watch page. Example
  // (dummy) cards stay exactly as before — not clickable, since
  // they don't point to anything real.
  if (video.videoId) {
    return (
      <Link
        href={`/watch/${video.videoId}`}
        className="group transition-all duration-300"
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <article
      className="
        group
        transition-all
        duration-300
      "
    >
      {cardContent}
    </article>
  );
}

export default function RecommendationFeed({
  realVideos = [],
  realShorts = [],
  view = "horizontal",
}: RecommendationFeedProps) {
  // Real uploaded content always appears first, unshuffled — the example
  // data behind it gets shuffled the same way as before. Render in
  // original order first (matches server output), then shuffle
  // client-side only after mount, to avoid a hydration mismatch.
  const [items, setItems] = useState<Recommendation[]>([
    ...realVideos,
    ...recommendations,
  ]);
  const [shuffledShorts, setShuffledShorts] = useState<Short[]>([
    ...realShorts,
    ...shorts,
  ]);

  useEffect(() => {
    const shuffledRecs = [...recommendations];
    for (let i = shuffledRecs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledRecs[i], shuffledRecs[j]] = [shuffledRecs[j], shuffledRecs[i]];
    }
    setItems([...realVideos, ...shuffledRecs]);

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

  // Keep the discovery feed in repeating YouTube-style blocks: exactly four
  // standard videos, then the next unused shelf of Shorts. New uploads flow
  // into the same sequence instead of being stranded after a one-off section.
  const videoBatches = Array.from(
    { length: Math.ceil(items.length / 4) },
    (_, index) => items.slice(index * 4, index * 4 + 4)
  );
  const shortsPerShelf = 8;

  const renderCard = (video: Recommendation) => (
    <HomeVideoCard key={video.id} video={video} />
  );

  // Vertical view: a Shorts-only responsive grid (fills every device width,
  // 2 columns on the smallest phones up to 6 on wide desktops/TVs).
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

  // Horizontal view: repeat four normal video cards followed by a Shorts
  // shelf for as long as there is content to display.
  return (
    <>
      {videoBatches.map((videos, index) => {
        const shelfShorts = shuffledShorts.slice(
          index * shortsPerShelf,
          (index + 1) * shortsPerShelf
        );

        return (
          <div key={`feed-block-${index}`}>
            <section className="mx-auto max-w-[1800px] px-4 py-5 lg:py-8 lg:px-8">
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {videos.map(renderCard)}
              </div>
            </section>
            {shelfShorts.length > 0 && <ShortsShelf items={shelfShorts} />}
          </div>
        );
      })}
    </>
  );
}
