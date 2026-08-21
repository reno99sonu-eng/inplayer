import type { MetadataRoute } from "next";
import { getReadyVideos } from "./lib/videoStore";
import { filterByAudience, DEFAULT_AUDIENCE_MODE } from "./lib/contentAccess";
import { playables } from "./data/playables";

const SITE_URL = "https://inplayer.in";

// Static, always-public marketing/content pages only. Deliberately
// excludes anything that requires sign-in to actually see real content
// (account, settings, messages, my-videos, upload, admin, watchlist,
// etc.) — a sitemap entry for a URL Google can't load as a real visitor
// just wastes crawl budget, and Search Console has flagged issues from
// exactly this class of problem before (see the "Duplicate without
// user-selected canonical" and "Page with redirect" reports this file
// helps address).
const STATIC_ROUTES: Array<{ path: string; priority: number }> = [
  { path: "", priority: 1 },
  { path: "/videos", priority: 0.8 },
  { path: "/shorts", priority: 0.7 },
  { path: "/live", priority: 0.7 },
  { path: "/shop", priority: 0.7 },
  { path: "/creators", priority: 0.6 },
  { path: "/help", priority: 0.4 },
  { path: "/terms", priority: 0.3 },
  { path: "/privacy", priority: 0.3 },
  { path: "/hammart-vendor-terms", priority: 0.3 },
];

// Rebuild at most once an hour — a sitemap doesn't need to be
// second-accurate, and this avoids re-scanning the videos table on every
// single crawler hit.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map(
    ({ path, priority }) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: path === "" ? "daily" : "weekly",
      priority,
    })
  );

  // Each of these now has its own real title/description via
  // generateMetadata (see app/play/[gameId]/page.tsx) — playables is a
  // small static array, not a database read, so this is free and can't
  // fail.
  const gameEntries: MetadataRoute.Sitemap = playables.map((game) => ({
    url: `${SITE_URL}/play/${game.id}`,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  // Video watch pages are the bulk of the site's real content, and
  // listing them explicitly here is exactly the missing signal that tells
  // Google "these are the canonical URLs for this content" — the gap
  // behind the Search Console "Duplicate without user-selected canonical"
  // report. Falls back to just the static routes (never throws) if the
  // read ever fails — same "real data or an honest empty state, but never
  // a broken page" convention as the rest of this app (see
  // app/lib/trendingStore.ts) — a sitemap hiccup must never take the
  // whole route down.
  try {
    // Deliberately filtered at the DEFAULT (safe) audience mode rather than
    // any particular viewer's: a sitemap is generated with no request and
    // no cookie, and 18+ URLs have no business being handed to search
    // engines regardless of who can unlock them inside the app.
    const videos = filterByAudience(await getReadyVideos(), DEFAULT_AUDIENCE_MODE);
    const videoEntries: MetadataRoute.Sitemap = videos
      .filter((video) => Boolean(video.videoId))
      .slice(0, 500)
      .map((video) => {
        const uploadedAt = video.uploadedAt as string | undefined;
        return {
          url: `${SITE_URL}/watch/${video.videoId as string}`,
          lastModified: uploadedAt ? new Date(uploadedAt) : undefined,
          changeFrequency: "weekly" as const,
          priority: 0.65,
        };
      });
    return [...staticEntries, ...gameEntries, ...videoEntries];
  } catch (err) {
    console.error(
      "sitemap: failed to list videos, returning static routes only:",
      err
    );
    return [...staticEntries, ...gameEntries];
  }
}
