"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import MuxPlayer from "@mux/mux-player-react";
import { MoreVertical, ChevronDown } from "lucide-react";
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
}

// A single homepage video card. Owns its own hover-preview state so each
// card starts/stops its preview independently of every other card on the
// page.
function VideoCard({ video }: { video: Recommendation }) {
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
              next/image doesn't optimize/serve cleanly. */}
          <img
            src={video.avatar}
            alt={video.creator}
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

          <div className="mt-2 flex items-center gap-1 text-sm text-slate-400 light:text-slate-500">
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
            light:text-slate-500
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
  const [showAll, setShowAll] = useState(false);

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

  // Recommendations split into three batches: two rows worth, then two more
  // rows worth, then everything else
  const firstVideos = items.slice(0, 10);
  const secondVideos = items.slice(10, 20);
  const remainingVideos = items.slice(20);

  // Shorts split across the two placements: a single compact row first,
  // then the rest in the full grid further down
  const shortsRowOne = shuffledShorts.slice(0, 8);
  const shortsRowTwo = shuffledShorts.slice(8);

  const renderCard = (video: Recommendation) => (
    <VideoCard key={video.id} video={video} />
  );

  return (
    <>
      {/* First batch of recommendations */}
      <section className="mx-auto max-w-[1800px] px-4 py-5 lg:py-10 lg:px-8">
        <div
          className="
            grid
            grid-cols-1
            gap-x-6
            gap-y-10

            sm:grid-cols-2
            lg:grid-cols-3
            xl:grid-cols-4
            2xl:grid-cols-5
          "
        >
          {firstVideos.map(renderCard)}
        </div>
      </section>

      {/* Shorts — first row */}
      <ShortsShelf items={shortsRowOne} />

      {/* Second batch of recommendations */}
      <section className="mx-auto max-w-[1800px] px-4 py-3 lg:py-6 lg:px-8">
        <div
          className="
            grid
            grid-cols-1
            gap-x-6
            gap-y-10

            sm:grid-cols-2
            lg:grid-cols-3
            xl:grid-cols-4
            2xl:grid-cols-5
          "
        >
          {secondVideos.map(renderCard)}
        </div>
      </section>

      {/* Shorts — second row */}
      <ShortsShelf items={shortsRowTwo} />

      {/* Remaining Recommendations — only rendered once "Show More" is clicked */}
      {remainingVideos.length > 0 && (
        <section className="mx-auto max-w-[1800px] px-4 pb-4 lg:px-8">
          {showAll && (
            <div
              className="
                grid
                grid-cols-1
                gap-x-6
                gap-y-10

                sm:grid-cols-2
                lg:grid-cols-3
                xl:grid-cols-4
                2xl:grid-cols-5
              "
            >
              {remainingVideos.map(renderCard)}
            </div>
          )}

          {!showAll && (
            <div className="mt-2 mb-4 flex justify-center">
              <button
                onClick={() => setShowAll(true)}
                className="
                  group
                  relative
                  overflow-hidden
                  rounded-full
                  border
                  border-orange-400/30
                  bg-gradient-to-r
                  from-[#111827]
                  via-[#182234]
                  to-[#111827]
                  light:from-slate-100
                  light:via-white
                  light:to-slate-100
                  px-7
                  py-3.5
                  text-white
                  light:text-slate-900
                  shadow-[0_0_30px_rgba(249,115,22,.12)]
                  transition-all
                  duration-300
                  active:scale-95
                "
              >
                {/* Animated Glow */}
                <span
                  className="
                    absolute
                    inset-0
                    opacity-0
                    bg-gradient-to-r
                    from-orange-500/10
                    via-yellow-300/10
                    to-orange-500/10
                    transition-opacity
                    duration-300
                    group-hover:opacity-100
                  "
                />

                <span className="relative flex items-center gap-2">
                  <span className="font-semibold tracking-wide">
                    Show More
                  </span>

                  <ChevronDown
                    size={18}
                    className="
                      transition-transform
                      duration-300
                      group-hover:translate-y-1
                    "
                  />
                </span>
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
