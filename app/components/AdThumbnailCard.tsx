"use client";

import { useEffect, useState } from "react";

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
export default function AdThumbnailCard({
  placement = "homepage",
}: {
  placement?: "homepage" | "watch";
}) {
  const [data, setData] = useState<AdResponse | null>(null);
  const [imageBroken, setImageBroken] = useState(false);

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

  if (!data || data.source !== "house") return null;

  const creative = data.creative;
  if (!creative || !creative.imageUrl || imageBroken) return null;

  const handleClick = () => {
    fetch("/api/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId: creative.adId }),
    }).catch(() => {});
  };

  return (
    <article className="group">
      <a
        href={creative.linkUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleClick}
        className="relative block aspect-video overflow-hidden rounded-2xl bg-[#111827]"
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
