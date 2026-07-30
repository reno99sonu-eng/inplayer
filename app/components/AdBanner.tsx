"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

interface HouseCreative {
  adId: string;
  imageUrl: string;
  linkUrl: string;
  title: string;
}

type AdResponse =
  | { source: "off" }
  | { source: "house"; creative: HouseCreative }
  | { source: "adsense"; adsensePublisherId: string };

// Real ad slot — renders whatever Admin Panel -> Advertising has
// configured for this placement (a house creative, a real Google AdSense
// unit, or nothing at all). Fails silently to "render nothing" on any
// error, exactly like every other optional widget on this site (never
// worth breaking the page over an ad).
export default function AdBanner({ placement }: { placement: "homepage" | "watch" }) {
  const [data, setData] = useState<AdResponse | null>(null);

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

  // AdSense requires the global script to load, then an explicit push()
  // per <ins> unit once it's in the DOM.
  useEffect(() => {
    if (data?.source !== "adsense") return;
    try {
      // @ts-expect-error -- adsbygoogle is injected globally by Google's script
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error("AdBanner: adsbygoogle push failed:", err);
    }
  }, [data]);

  if (!data || data.source === "off") return null;

  if (data.source === "house") {
    const { creative } = data;
    const handleClick = () => {
      fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: creative.adId }),
      }).catch(() => {
        /* best-effort click tracking — never blocks the actual click-through */
      });
    };

    return (
      <div className="mx-auto w-full max-w-[1300px] px-3 lg:px-0">
        <a
          href={creative.linkUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={handleClick}
          className="group relative block overflow-hidden rounded-2xl border border-white/10 light:border-black/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- creative
              images are arbitrary admin-uploaded data URLs, not a static
              app asset next/image can optimize. */}
          <img
            src={creative.imageUrl}
            alt={creative.title}
            className="block w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80">
            Ad
          </span>
        </a>
      </div>
    );
  }

  // data.source === "adsense"
  return (
    <div className="mx-auto w-full max-w-[1300px] px-3 lg:px-0">
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
