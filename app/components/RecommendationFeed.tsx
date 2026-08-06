"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import nextDynamic from "next/dynamic";
import { MoreVertical } from "lucide-react";
import VideoOptionsMenu from "./watch/VideoOptionsMenu";

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
import TrendingNow from "./TrendingNow";
import AdThumbnailCard from "./AdThumbnailCard";
import { useSettings } from "./settings/SettingsProvider";
import {
  getActivePreviewId,
  requestActivePreview,
  releaseActivePreview,
  subscribeToActivePreview,
} from "./videoPreviewGate";

// Hover-preview delay — don't start streaming a preview for every card the
// mouse passes over while scrolling, only once the user actually pauses on
// one (matches YouTube's own hover-preview behavior). Shortened from the
// original 400ms — the bigger part of the "slow to start" feeling was the
// on-demand @mux/mux-player-react chunk load (see the prefetch effect in
// the default export below), but a snappier delay helps too.
const HOVER_PREVIEW_DELAY = 200;

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
      <Link href={`/shorts?v=${short.videoId}`} className="group" prefetch={false}>
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
  // A stable per-card identity used only to claim/release the single
  // shared preview slot below — never rendered or compared by value, just
  // needs to stay the same object across this card's re-renders. A lazy
  // useState initializer (not useRef) is what actually guarantees that:
  // reading ref.current during render is itself against the rules of React
  // (refs are for effects/handlers, not render), which is exactly why this
  // is state instead.
  const [cardId] = useState<symbol>(() => Symbol(video.id));
  const [canHover, setCanHover] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { playback } = useSettings();

  // Only one card's preview may stream at a time, app-wide — see
  // videoPreviewGate.ts for why this has to be a shared gate rather than
  // each card owning its own independent "am I previewing" state. This
  // subscribes to that shared slot and re-renders only when THIS card's
  // own active/inactive status actually changes.
  const [activePreviewId, setActivePreviewId] = useState<symbol | null>(
    () => getActivePreviewId()
  );
  useEffect(() => subscribeToActivePreview(setActivePreviewId), []);
  const previewing = activePreviewId === cardId;

  // Release this card's claim on the shared slot if it unmounts while
  // active (e.g. the shuffled feed re-renders a different set of cards),
  // so the slot doesn't stay permanently stuck "held" by a card that no
  // longer exists.
  useEffect(() => {
    return () => releaseActivePreview(cardId);
  }, [cardId]);

  // Only real devices with an actual mouse get the hover preview — on
  // touch devices "hover" is either unsupported or fires unreliably on
  // first tap, which would make thumbnails flicker/misbehave.
  useEffect(() => {
    (() => {
      setCanHover(
        typeof window !== "undefined" &&
          window.matchMedia("(hover: hover) and (pointer: fine)").matches
      );
    })();
  }, []);

  // Touch devices have no hover state at all, so the preview never had a
  // way to trigger on mobile. The mobile equivalent: autoplay the muted
  // preview once the card is significantly scrolled into view, same as
  // Instagram/Facebook video feeds do. Only wired up when the device
  // genuinely can't hover, so this and the mouse-hover behavior above
  // never both fire for the same card. Skipped entirely when Data Saver
  // is on (Settings → Playback) — that's the real, working effect of the
  // toggle: no autoplaying preview clips burning mobile data.
  //
  // Crucially, this no longer sets local "previewing" state directly —
  // several cards can cross the 60%-visible threshold in the same instant
  // (e.g. right when the homepage first finishes loading), and without the
  // shared gate below, every one of them used to start streaming its own
  // preview clip at once. Now this only ever REQUESTS the shared slot;
  // whichever card's request lands last wins, and every other card that
  // was previously showing a preview is told to stop via the subscription
  // above — so at most one preview is ever actually streaming.
  useEffect(() => {
    if (canHover || !video.muxPlaybackId || !cardRef.current || playback.dataSaver) return;

    const el = cardRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) requestActivePreview(cardId);
        else releaseActivePreview(cardId);
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      releaseActivePreview(cardId);
    };
  }, [canHover, video.muxPlaybackId, playback.dataSaver, cardId]);

  const startPreview = () => {
    if (!canHover || !video.muxPlaybackId || playback.dataSaver) return;
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

  const thumbnail = (
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
              // Deliberately NOT wired to Settings → Playback → "Closed
              // Captions" — this is a silent, muted hover-preview loop, not
              // real playback, so captions here would just overlay text on
              // a tiny thumbnail nobody asked to read. The real watch page
              // (VideoPlayer.tsx), Shorts feed, and live stream player all
              // do respect the real setting.
              defaultHiddenCaptions={true}
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
  );

  const avatar = (
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
  );

  const information = (
    <div className="mt-4 flex items-start gap-3">
      {video.uploaderUsername ? (
        <Link
          href={`/u/${encodeURIComponent(video.uploaderUsername)}`}
          aria-label={`Open ${video.creator}'s channel`}
          className="flex-shrink-0 transition-transform hover:scale-105 focus-visible:rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
          prefetch={false}
        >
          {avatar}
        </Link>
      ) : (
        avatar
      )}

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
            {video.videoId ? (
              <Link
                href={`/watch/${video.videoId}`}
                className="transition hover:text-orange-200"
                prefetch={false}
              >
                {video.title}
              </Link>
            ) : (
              video.title
            )}
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

      {/* This used to be a plain <button><MoreVertical/></button> with no
          onClick at all — it looked real but did nothing when tapped.
          Swapped for the same "More options" menu already wired up (real
          Watch Later / Save to playlist / Report backends) on the watch
          page, instead of inventing a second, redundant menu here. Only
          for real uploaded videos — the example/dummy cards below (no
          videoId) keep the old inert icon, since there's nothing real for
          them to open. */}
      {video.videoId ? (
        <VideoOptionsMenu videoId={video.videoId} />
      ) : (
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
      )}
    </div>
  );

  // Real uploaded videos link to their actual watch page. Example
  // (dummy) cards stay exactly as before — not clickable, since
  // they don't point to anything real.
  if (video.videoId) {
    return (
      <article className="group transition-all duration-300">
        <Link
          href={`/watch/${video.videoId}`}
          aria-label={`Watch ${video.title}`}
          className="block"
          prefetch={false}
        >
          {thumbnail}
        </Link>
        {information}
      </article>
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
      {thumbnail}
      {information}
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

  // Proactively fetch the Mux player chunk in the background as soon as the
  // feed mounts, instead of waiting for a card's first hover/scroll-preview
  // to trigger the on-demand import() (see the nextDynamic() call up top).
  // That first-ever preview was the real "auto previews are a bit slower to
  // work" delay Reno reported — the browser had to fetch + parse the whole
  // player bundle before any preview could start. This warms the module
  // cache ahead of time (dynamic import() is a no-op on subsequent calls
  // once resolved) so by the time a real preview fires, the chunk is
  // already loaded.
  useEffect(() => {
    import("@mux/mux-player-react");
  }, []);

  useEffect(() => {
    (() => {
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
    })();
  }, [realVideos, realShorts]);

  // One ad slot, inserted at a random point among every 8/16/20 videos —
  // picked client-side only (after mount) so the server-rendered and
  // first-paint client markup still match; the ad simply isn't there yet
  // for that very first render, same reasoning as the shuffle above. Never
  // displaces a real video — everything after the ad just shifts down one
  // grid slot, same as a normal ad insertion anywhere else.
  const [adSlotIndex, setAdSlotIndex] = useState<number | null>(null);

  useEffect(() => {
    (() => {
      const candidates = [8, 16, 20].filter((n) => n <= items.length);
      setAdSlotIndex(
        candidates.length > 0
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : null
      );
    })();
  }, [items.length]);

  type FeedEntry = { kind: "video"; video: Recommendation } | { kind: "ad" };
  const feedEntries: FeedEntry[] = [];
  items.forEach((video, index) => {
    if (adSlotIndex !== null && index === adSlotIndex) {
      feedEntries.push({ kind: "ad" });
    }
    feedEntries.push({ kind: "video", video });
  });

  // Keep the discovery feed in repeating YouTube-style blocks for the video
  // grid itself — how many videos make up one block matches how many
  // actually fit a "row" at the current viewport, instead of one fixed
  // number for every screen size:
  //   - Mobile/tablet (<1024px, the grid's 1-2 column range below): 4
  //     videos per block.
  //   - Desktop (>=1024px, matching the grid's own 4-column xl
  //     breakpoint): two full rows of four videos (eight) per block.
  // A Shorts shelf still appears every second block, so it doesn't crowd
  // out the video grid. New uploads flow into the same sequence instead of
  // being stranded after a one-off section.
  //
  // Raftaar (Trending Creators) is real, live-ranked data, not per-block
  // filler — every block asks the same /api/trending endpoint and gets
  // back the exact same ranked list, so repeating it after every block (as
  // this used to do) just showed the identical set of names again and
  // again as you scrolled, reading as a stuck/duplicated section rather
  // than "fresh" content. It's rendered once, after the first block, below.
  //
  // Detected client-side only (post-mount, same reasoning as the
  // shuffle/ad-slot logic above) since server-rendered HTML can't know the
  // visitor's real viewport — defaults to the desktop grouping so the very
  // first paint matches the server-rendered markup, then re-groups once
  // mount detects a narrower screen. A live "change" listener keeps it
  // correct if the window is resized without a reload, instead of only
  // being checked once on mount.
  const [blockSize, setBlockSize] = useState(8);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const applyBlockSize = () => setBlockSize(mql.matches ? 8 : 4);
    applyBlockSize();
    mql.addEventListener("change", applyBlockSize);
    return () => mql.removeEventListener("change", applyBlockSize);
  }, []);

  const feedBatches = Array.from(
    { length: Math.ceil(feedEntries.length / blockSize) },
    (_, index) => feedEntries.slice(index * blockSize, index * blockSize + blockSize)
  );
  const shortsPerShelf = 8;

  const renderEntry = (entry: FeedEntry) =>
    entry.kind === "ad" ? (
      <AdThumbnailCard key="ad-slot" />
    ) : (
      <HomeVideoCard key={entry.video.id} video={entry.video} />
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

  // Horizontal view: repeat an 8-video (two-row) grid followed by a
  // Raftaar row, then a Shorts shelf every second block, for as long as
  // there is content to display.
  //
  // shelfCursor (below) is a SEPARATE counter from the block's own index —
  // this used to slice shuffledShorts with the block index itself
  // (index * shortsPerShelf), which only ever rendered a shelf on ODD
  // block indexes (1, 3, 5…) but sliced shuffledShorts starting from
  // EVERY index including the even ones. That silently threw away the
  // slice at index 0 — shuffledShorts[0..8) — every single time, forever,
  // no matter how far you scrolled. Since real, newly-uploaded shorts are
  // placed at the very front of shuffledShorts (realShorts first, dummy
  // filler after), they landed almost entirely inside that permanently-
  // skipped slice: new shorts uploaded a visitor would never see them in
  // the homepage feed, only on the dedicated Shorts page (which reads the
  // same shuffledShorts list unsliced). shelfCursor now only advances when
  // a shelf actually renders, so the slices handed out are 0..8, 8..16,
  // 16..24… with nothing skipped — new shorts show up in the very first
  // shelf that appears.
  let shelfCursor = 0;

  return (
    <>
      {feedBatches.map((entries, index) => {
        const wantsShelf = index % 2 === 1;
        let shelfShorts: Short[] = [];
        let showShortsShelf = false;

        if (wantsShelf) {
          shelfShorts = shuffledShorts.slice(
            shelfCursor * shortsPerShelf,
            (shelfCursor + 1) * shortsPerShelf
          );
          if (shelfShorts.length > 0) {
            showShortsShelf = true;
            shelfCursor += 1;
          }
        }

        return (
          <div key={`feed-block-${index}`}>
            <section className="mx-auto max-w-[1800px] px-4 py-5 lg:py-8 lg:px-8">
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {entries.map(renderEntry)}
              </div>
            </section>

            {index === 0 && <TrendingNow />}

            {showShortsShelf && <ShortsShelf items={shelfShorts} />}
          </div>
        );
      })}
    </>
  );
}
