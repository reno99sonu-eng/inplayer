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

const AUTO_SCROLL_MS = 4000;

export default function AdBanner({
  placement,
  seed = 0,
}: {
  placement: "homepage" | "watch" | "homepage_spotlight";
  seed?: number;
}) {
  const [data, setData] = useState<AdResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(seed);
  const [isHovered, setIsHovered] = useState(false);
  const [failedAdIds, setFailedAdIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ads?placement=${placement}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        console.error("AdBanner: fetch failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placement]);

  const creatives =
    data?.source === "house"
      ? data.creatives && data.creatives.length > 0
        ? data.creatives
        : [data.creative]
      : [];

  // Auto-scroll loop for multi-creative carousels
  useEffect(() => {
    if (isHovered || creatives.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % creatives.length);
    }, AUTO_SCROLL_MS);

    return () => clearInterval(timer);
  }, [creatives.length, isHovered]);

  // AdSense initialization
  useEffect(() => {
    if (data?.source !== "adsense") return;
    try {
      // @ts-expect-error -- adsbygoogle is injected globally
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error("AdBanner: adsbygoogle push failed:", err);
    }
  }, [data]);

  if (!data || data.source === "off" || (data.source === "house" && creatives.length === 0)) {
    return null;
  }

  if (data.source === "house") {
    const activeCreative = creatives[Math.abs(currentIndex) % creatives.length];
    const isImageBroken = Boolean(failedAdIds[activeCreative.adId] || !activeCreative.imageUrl);

    const handleClick = (creative: HouseCreative) => {
      fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: creative.adId }),
      }).catch(() => {});
    };

    return (
      <div
        className="mx-auto w-full max-w-[1800px] px-4 lg:px-8 my-1 sm:my-2"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative overflow-hidden rounded-2xl border border-white/10 light:border-black/10 bg-[#060D18] shadow-md">
          {/* Ad slide link */}
          <a
            href={activeCreative.linkUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() => handleClick(activeCreative)}
            className={`group relative flex aspect-video sm:aspect-[10/1] w-full items-center justify-center overflow-hidden transition duration-300 bg-[#060D18] ${
              // "watch" is the one placement whose box isn't always
              // full-row width — WatchPageContent.tsx moves it into a
              // narrower 360px sidebar column at the xl breakpoint. A
              // single fixed height/aspect ratio for the whole component
              // used to mean this box's crop ratio silently changed with
              // screen width (no upload size was ever crop-proof). Now
              // every placement has one exact, fixed, documented ratio per
              // context instead: 16:9 on mobile, 10:1 on tablet/desktop,
              // and — for "watch" only — 4:1 once it narrows into the
              // sidebar at xl+, matching that column's real proportions
              // instead of squashing to a sliver.
              placement === "watch" ? "xl:aspect-[4/1]" : ""
            }`}
          >
            {isImageBroken ? (
              <div className="flex h-full w-full items-center justify-between bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900 px-6 py-2">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-orange-500/20 px-3 py-1 text-[10px] font-black uppercase text-orange-400 border border-orange-500/30">
                    Sponsored
                  </span>
                  <span className="text-xs sm:text-sm font-black text-white truncate max-w-[300px] sm:max-w-[500px]">
                    {activeCreative.title || "InPlayer Special Showcase Offer"}
                  </span>
                </div>
                <span className="rounded-xl bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-900 shadow hover:bg-orange-400 transition">
                  Explore ↗
                </span>
              </div>
            ) : activeCreative.imageUrl?.startsWith("data:video/") ||
              /\.mp4|\.webm/i.test(activeCreative.imageUrl || "") ? (
              <video
                src={activeCreative.imageUrl}
                autoPlay
                loop
                muted
                playsInline
                onError={() => setFailedAdIds((prev) => ({ ...prev, [activeCreative.adId]: true }))}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.01]"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={activeCreative.imageUrl}
                alt={activeCreative.title || "Advertisement"}
                onError={() => setFailedAdIds((prev) => ({ ...prev, [activeCreative.adId]: true }))}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.01]"
              />
            )}

            {/* AD badge */}
            {!isImageBroken && (
              <span className="absolute right-2 top-2 z-10 rounded-md bg-black/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-orange-400 border border-orange-500/30">
                Ad
              </span>
            )}

            {/* Title overlay hint */}
            {!isImageBroken && activeCreative.title && (
              <div className="absolute left-3 bottom-2 z-10 rounded-lg bg-black/75 backdrop-blur-md px-2.5 py-1 text-xs font-semibold text-white border border-white/10">
                {activeCreative.title}
              </div>
            )}
          </a>

          {/* Carousel dots for multiple ad creatives */}
          {creatives.length > 1 && (
            <div className="absolute bottom-1.5 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-md">
              {creatives.map((c, idx) => (
                <button
                  key={c.adId || idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Ad slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentIndex ? "w-5 bg-orange-400" : "w-1.5 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
