import type { MetadataRoute } from "next";

const SITE_URL = "https://inplayer.in";

// Points crawlers at the canonical sitemap and keeps them out of
// sign-in-gated / admin / API surfaces that were never meant to be
// indexed in the first place. Purely additive — this file didn't exist
// before, so there is no previous behavior to change.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/account",
        "/settings",
        "/messages",
        "/milonbook",
        "/upload",
        "/my-videos",
        "/liked-videos",
        "/playlists",
        "/history",
        "/watchlist",
        "/subscriptions",
        "/geo-blocked",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
