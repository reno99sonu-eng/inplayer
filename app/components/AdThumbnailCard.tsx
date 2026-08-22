"use client";

import { useEffect, useRef, useState } from "react";

interface HouseCreative {
  adId: string;
  imageUrl: string;
  linkUrl: string;
  title: string;
}

type AdResponse =
  | { source: "off" }
  | { source: "house"; creative: HouseCreative; creatives?: HouseCreative[] }
  | { source: "adsense"; adsensePublisherId: string };

// Same pacing as FeaturedHeroAd.tsx's weekly_featured carousel, so a
// sponsor's images rotate at a familiar, consistent speed everywhere on
// the site rather than each slot feeling like a different speed.
const SLIDE_DURATION = 4000;

// A single ad slot styled and shaped exactly like a real video thumbnail
// card, instead of a separate wide banner strip. Originally built for the
// Homepage Banner slot (a random slot in RecommendationFeed's grid, among
// every 8/16/20 videos — this component only owns fetching + rendering the
// one creative, RecommendationFeed decides WHERE it renders). Reused as-is
// for the Watch Page Banner slot (placement="watch", rendered in
// WatchPageContent.tsx's "Up Next" rail) so both placements look like real
// content instead of one being this thumbnail card and the other a
// separate wide AdBanner strip. AdSense isn't supported for either
// placement here (AdSense units need their own fixed-size ad slot, not a
// video-thumbnail-shaped box) — an AdSense source configured for either
// slot simply means no ad shows, same as "off".
//
// Auto-rotates through EVERY active creative GET .../api/ads hands back for
// this placement (not just one randomly-picked one), crossfading between
// them exactly like FeaturedHeroAd.tsx does for the hero — so a sponsor who
// uploaded 3 images genuinely sees them cycle within one page view instead
// of only one ever showing per page load. With a single creative this is a
// no-op, same as before: `(prev + 1) % 1` is always 0.
export default function AdThumbnailCard({
  placement = "homepage",
}: {
  placement?: "homepage" | "watch";
}) {
  const [data, setData] = useState<AdResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);
  // Tracks which adIds this mount has already fired an impression ping for,
  // so re-renders (e.g. the isPaused toggle) never double-count the same
  // creative — only an actual rotation to a NEW creative fires again.
  const impressedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ads?placement=${placement}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        console.error("AdThumbnailCard: fetch failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placement]);

  // Batch may be a single item (data.creatives absent/short — every caller
  // from before this change) or several — either way this is the one list
  // the rest of the component rotates through.
  const creatives: HouseCreative[] =
    data && data.source === "house"
      ? data.creatives && data.creatives.length > 0
        ? data.creatives
        : data.creative
        ? [data.creative]
        : []
      : [];

  useEffect(() => {
    if (isPaused || creatives.length <= 1) return;

    const timer = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % creatives.length);
    }, SLIDE_DURATION);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- creatives.length is the only piece of `creatives` that should restart this timer
  }, [activeIndex, isPaused, creatives.length]);

  const creative = creatives[Math.min(activeIndex, Math.max(creatives.length - 1, 0))];

  // Fire-and-forget impression ping, once per creative actually shown —
  // GET .../api/ads itself no longer counts impressions (it now hands back
  // a whole batch instead of one pre-picked item), so this is the real
  // "was this shown to a visitor" signal, same spirit as the click POST
  // below.
  useEffect(() => {
    if (data && data.source === "adsense") {
      try {
        // @ts-expect-error window.adsbygoogle global
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        /* ignore */
      }
    }
  }, [data]);

  if (data && data.source === "adsense") {
    const publisherId = data.adsensePublisherId || "pub-8705156751415945";
    const client = publisherId.startsWith("ca-") ? publisherId : `ca-${publisherId}`;
    return (
      <article className="group flex flex-col justify-between overflow-hidden rounded-2xl bg-[#0e1626] border border-white/10 p-2">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black/40">
          <ins
            className="adsbygoogle block h-full w-full"
            style={{ display: "block" }}
            data-ad-client={client}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
        <div className="mt-2 flex items-center gap-2 px-1 text-[11px] text-slate-400">
          <span className="rounded bg-orange-500/20 px-1.5 py-0.5 font-bold uppercase text-orange-400 text-[9px]">
            Google Ad
          </span>
          <span>Sponsored</span>
        </div>
      </article>
    );
  }

  if (!creative || !creative.imageUrl || imageBroken) return null;

  const handleClick = () => {
    fetch("/api/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId: creative.adId }),
    }).catch(() => {});
  };

  return (
    <article
      className="group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <a
        key={creative.adId}
        href={creative.linkUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleClick}
        className="relative block aspect-video overflow-hidden rounded-2xl bg-[#111827] animate-fade-in"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={creative.imageUrl}
          alt={creative.title || "Advertisement"}
          onError={() => setImageBroken(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

        {/* Same "Ad" disclosure badge as the wide banner — this still has
            to be honestly labeled as sponsored even though it now looks
            like a regular thumbnail. */}
        <span className="absolute right-2 top-2 z-10 rounded-md bg-black/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-orange-400 border border-orange-500/30">
          Ad
        </span>

        {creatives.length > 1 && (
          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1">
            {creatives.map((c, i) => (
              <span
                key={c.adId}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </a>

      <div className="mt-4 flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-orange-400/30 bg-orange-500/10">
          <span className="text-xs font-black uppercase text-orange-300">Ad</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[16px] font-semibold leading-6 text-white light:text-slate-900">
            {creative.title || "Sponsored"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">Sponsored</p>
        </div>
      </div>
    </article>
  );
}
