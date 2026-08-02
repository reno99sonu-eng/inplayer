"use client";

import { useEffect, useState, useRef } from "react";
import Script from "next/script";

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
}: {
  placement: "homepage" | "watch" | "homepage_spotlight";
}) {
  const [data, setData] = useState<AdResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

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
    const activeCreative = creatives[Math.min(currentIndex, creatives.length - 1)];

    const handleClick = (creative: HouseCreative) => {
      fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: creative.adId }),
      }).catch(() => {});
    };

    return (
      <div
        className="mx-auto w-full max-w-[1300px] px-2 sm:px-4 my-2 sm:my-3"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative overflow-hidden rounded-2xl border border-white/10 light:border-black/10 bg-black/40 shadow-lg">
          {/* Ad slide link */}
          <a
            href={activeCreative.linkUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() => handleClick(activeCreative)}
            className="group relative block w-full overflow-hidden transition duration-300 max-h-[140px] sm:max-h-[180px] lg:max-h-[220px] aspect-[16/5]"
          >
            {activeCreative.imageUrl?.startsWith("data:video/") ||
            /\.mp4|\.webm/i.test(activeCreative.imageUrl || "") ? (
              <video
                src={activeCreative.imageUrl}
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.01]"
              />
            ) : (
              <img
                src={activeCreative.imageUrl}
                alt={activeCreative.title}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.01]"
              />
            )}

            {/* AD badge */}
            <span className="absolute right-2 top-2 z-10 rounded-full bg-black/75 backdrop-blur-md px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-orange-400 border border-orange-500/20">
              Ad
            </span>

            {/* Title overlay hint */}
            {activeCreative.title && (
              <div className="absolute left-3 bottom-3 z-10 hidden sm:block rounded-xl bg-black/70 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white border border-white/10">
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

  // data.source === "adsense"
  return (
    <div className="mx-auto w-full max-w-[1300px] px-2 sm:px-4 my-3">
      <Script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-${data.adsensePublisherId}`}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <ins
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={`ca-pub-${data.adsensePublisherId}`}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
