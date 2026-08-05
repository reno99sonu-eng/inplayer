import FloatingAIButton from "./components/FloatingAIButton";
import FeaturedHero from "./components/featuredHero/FeaturedHero";
import FeaturedHeroAd from "./components/featuredHero/FeaturedHeroAd";
import RecommendationFeed from "./components/RecommendationFeed";
import { getReadyVideos } from "./lib/videoStore";
import { getFeaturedThisWeek } from "./lib/trendingStore";
import { getPlatformSettings } from "./lib/platformSettings";
import { getActiveAdCreative } from "./lib/adCreatives";
import type { Recommendation } from "./data/recommendations";
import type { Short } from "./data/shorts";
import type { FeaturedSlide } from "./data/featuredSlides";
import { resolveUsernames } from "./lib/resolveUsernames";

function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const totalSeconds = Math.round(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface RealContent {
  realVideos: Recommendation[];
  realShorts: Short[];
}

async function getRealContent(): Promise<RealContent> {
  try {
    // Shared 30-second cached list (see lib/videoStore) — no per-request
    // table Scan. Already sorted newest-first.
    const allReady = await getReadyVideos();

    // Only public videos surface in discovery feeds. Unlisted (link-only)
    // and private videos are filtered out here; unlisted stays reachable by
    // direct /watch link.
    const items = allReady.filter(
      (v) => !v.visibility || v.visibility === "public"
    );
    const usernames = await resolveUsernames(
      items.map((video) => video.uploaderId as string | null | undefined)
    );

    const realVideos: Recommendation[] = items
      .filter((video) => video.contentType !== "short")
      .map((video) => {
        const videoId = video.videoId as string;
        const uploaderId = video.uploaderId as string | undefined;
        return {
          id: videoId,
          videoId,
          // Withheld for a members-only video — this feeds the homepage's
          // hover-preview (see RecommendationFeed.tsx), which would
          // otherwise play the actual video for anyone hovering the card,
          // members-only or not. The card still shows and links to /watch,
          // it just can't preview on hover.
          muxPlaybackId: video.membersOnly
            ? undefined
            : (video.muxPlaybackId as string | undefined),
          title: video.title as string,
          creator: (video.uploaderName as string) || "Unknown",
          uploaderUsername: uploaderId
            ? usernames.get(uploaderId)
            : undefined,
          avatar: (video.uploaderAvatarUrl as string) || "/avatars/avatar.png",
          thumbnail:
            (video.thumbnailUrl as string) ||
            "/recommendations/thumbnails/1.jpg",
          views: `${(video.views as number) || 0} views`,
          uploaded: formatTimeAgo(video.uploadedAt as string),
          duration: formatDuration(video.duration as number),
          verified: false,
        };
      });

    const realShorts: Short[] = items
      .filter((video) => video.contentType === "short")
      .map((video) => {
        const videoId = video.videoId as string;
        const uploaderId = video.uploaderId as string | undefined;
        return {
          id: videoId,
          videoId,
          muxPlaybackId: video.muxPlaybackId as string | undefined,
          title: video.title as string,
          description: video.description as string | undefined,
          creator: (video.uploaderName as string) || "Unknown",
          uploaderId,
          uploaderUsername: uploaderId
            ? usernames.get(uploaderId)
            : undefined,
          uploaderAvatarUrl: video.uploaderAvatarUrl as string | undefined,
          poster: (video.thumbnailUrl as string) || "/shorts/1.jpg",
          views: `${(video.views as number) || 0} views`,
          likes: "0",
          comments: "0",
        };
      });

    return { realVideos, realShorts };
  } catch (err) {
    // If DynamoDB is briefly unreachable, fail gracefully rather than
    // breaking the whole homepage — just show the example data instead.
    console.error("Failed to fetch real content for homepage:", err);
    return { realVideos: [], realShorts: [] };
  }
}

// Server-side fetch of the same "top videos this week" data the old
// /api/featured-weekly route serves — called directly here (not via fetch)
// so the Weekly Featured hero already has real slides in the very first
// server-rendered HTML instead of showing a black placeholder while a
// client-side useEffect fetch resolves. RankedVideo (trendingStore's return
// type) matches FeaturedSlide's shape field-for-field, aside from
// uploaderUsername being optional (possibly `undefined`) there vs required
// (`string | null`) on FeaturedSlide — normalized below. The old API-route
// path never hit this mismatch only because JSON.stringify/parse silently
// drops `undefined` keys in transit.
async function getFeaturedSlides(): Promise<FeaturedSlide[]> {
  try {
    const videos = await getFeaturedThisWeek(6);
    return videos.map((video) => ({
      ...video,
      uploaderUsername: video.uploaderUsername ?? null,
    }));
  } catch (err) {
    console.error("Failed to fetch featured weekly videos for homepage:", err);
    return [];
  }
}

interface HeroAdCreative {
  adId: string;
  imageUrl: string;
  linkUrl: string;
  title: string;
}

type HeroContent =
  | { kind: "ad"; creative: HeroAdCreative }
  | { kind: "videos"; slides: FeaturedSlide[] };

// Decides what actually fills the homepage hero slot. Admin Panel ->
// Advertising -> Weekly Featured Banner is a single ON/OFF switch
// (weeklyFeaturedEnabled): OFF (default) keeps showing InPlayer's real
// "top videos this week" carousel (FeaturedHero.tsx); ON swaps it for the
// admin's own uploaded poster (FeaturedHeroAd.tsx) — the actual wiring
// that placement was missing (previously nothing on the live site read
// weeklyFeaturedEnabled or fetched a weekly_featured creative at all, so
// anything uploaded there never appeared to a real visitor). If ON but
// nothing's been uploaded/activated yet, this falls back to the real
// videos rather than leaving the hero blank — an empty gap at the very
// top of the homepage would be a worse first impression than showing real
// content while the admin finishes setting the poster up.
async function getHeroContent(): Promise<HeroContent> {
  try {
    const settings = await getPlatformSettings();
    if (settings.weeklyFeaturedEnabled) {
      const creative = await getActiveAdCreative("weekly_featured");
      if (creative) {
        return {
          kind: "ad",
          creative: {
            adId: creative.adId,
            imageUrl: creative.imageUrl,
            linkUrl: creative.linkUrl,
            title: creative.title,
          },
        };
      }
    }
  } catch (err) {
    console.error("Failed to resolve weekly featured hero content:", err);
  }
  return { kind: "videos", slides: await getFeaturedSlides() };
}

interface HomeProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  // "horizontal" (default) shows normal 16:9 videos; "vertical" swaps the
  // whole feed to Shorts. Driven by the Horizontal/Vertical chips in the
  // category bar (see NavigationCategories.tsx).
  const { view } = await searchParams;
  const activeView = view === "vertical" ? "vertical" : "horizontal";
  const isVertical = activeView === "vertical";

  // The hero only renders in horizontal view, so only fetch its data then —
  // no point paying for the extra query on the Shorts feed. Both fetches
  // run in parallel rather than sequentially.
  const [{ realVideos, realShorts }, heroContent] = await Promise.all([
    getRealContent(),
    isVertical
      ? Promise.resolve<HeroContent>({ kind: "videos", slides: [] })
      : getHeroContent(),
  ]);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#050816] light:bg-[#F4ECDA]">
      {/* Premium Background */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Dark Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#04060F] via-[#091224] to-[#04060F] light:from-[#F4ECDA] light:via-[#EFE6D0] light:to-[#F4ECDA]" />

        {/* Honeycomb Texture — Dark Mode */}
        <div
          className="absolute inset-0 opacity-[0.06] light:hidden"
          style={{
            backgroundImage:
              "radial-gradient(circle at 24px 24px, rgba(255,176,59,0.18) 2px, transparent 2px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Honeycomb Texture — Light Mode (warm amber dots on cream) */}
        <div
          className="absolute inset-0 hidden light:block"
          style={{
            backgroundImage:
              "radial-gradient(circle at 24px 24px, rgba(210,140,40,0.30) 2px, transparent 2px)",
            backgroundSize: "46px 46px",
            opacity: 0.5,
          }}
        />

        {/* Orange Ambient Glow */}
        <div className="absolute -left-64 top-20 h-[600px] w-[600px] rounded-full bg-orange-500/10 blur-[180px]" />

        {/* Blue Ambient Glow */}
        <div className="absolute -right-64 bottom-0 h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[180px] light:bg-amber-300/10" />
      </div>

      <div className="relative z-10">
        <div className="space-y-1 lg:space-y-2">
          {/* The cinematic hero is a horizontal-video showcase, so it only
              makes sense in the Horizontal view. Vertical view is a pure
              Shorts feed. The Raftaar (Trending Creators) row and the
              homepage ad no longer live here as one-off sections — Raftaar
              now repeats after every block of videos, and the ad is a
              random in-grid slot styled like a thumbnail, both owned by
              RecommendationFeed itself so the whole "videos, then Raftaar,
              then videos again" rhythm lives in one place. */}
          {!isVertical && (
            <>
              {heroContent.kind === "ad" ? (
                <FeaturedHeroAd creative={heroContent.creative} />
              ) : (
                <FeaturedHero initialSlides={heroContent.slides} />
              )}

              <div className="mx-auto h-px w-[92%] bg-gradient-to-r from-transparent via-white/10 to-transparent light:via-black/10" />
            </>
          )}

          <RecommendationFeed
            realVideos={realVideos}
            realShorts={realShorts}
            view={activeView}
          />
        </div>
      </div>

      <FloatingAIButton />
    </main>
  );
}
