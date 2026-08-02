import TrendingNow from "./components/TrendingNow";
import FloatingAIButton from "./components/FloatingAIButton";
import FeaturedHero from "./components/featuredHero/FeaturedHero";
import RecommendationFeed from "./components/RecommendationFeed";
import AdBanner from "./components/AdBanner";
import { getReadyVideos } from "./lib/videoStore";
import type { Recommendation } from "./data/recommendations";
import type { Short } from "./data/shorts";
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
      items.map((video) => video.uploaderId)
    );

    const realVideos: Recommendation[] = items
      .filter((video) => video.contentType !== "short")
      .map((video) => ({
        id: video.videoId,
        videoId: video.videoId,
        // Withheld for a members-only video — this feeds the homepage's
        // hover-preview (see RecommendationFeed.tsx), which would
        // otherwise play the actual video for anyone hovering the card,
        // members-only or not. The card still shows and links to /watch,
        // it just can't preview on hover.
        muxPlaybackId: video.membersOnly ? undefined : video.muxPlaybackId,
        title: video.title,
        creator: video.uploaderName || "Unknown",
        uploaderUsername: usernames.get(video.uploaderId),
        avatar: video.uploaderAvatarUrl || "/avatars/avatar.png",
        thumbnail: video.thumbnailUrl || "/recommendations/thumbnails/1.jpg",
        views: `${video.views || 0} views`,
        uploaded: formatTimeAgo(video.uploadedAt),
        duration: formatDuration(video.duration),
        verified: false,
      }));

    const realShorts: Short[] = items
      .filter((video) => video.contentType === "short")
      .map((video) => ({
        id: video.videoId,
        videoId: video.videoId,
        muxPlaybackId: video.muxPlaybackId,
        title: video.title,
        description: video.description,
        creator: video.uploaderName || "Unknown",
        uploaderId: video.uploaderId,
        uploaderUsername: usernames.get(video.uploaderId),
        uploaderAvatarUrl: video.uploaderAvatarUrl,
        poster: video.thumbnailUrl || "/shorts/1.jpg",
        views: `${video.views || 0} views`,
        likes: "0",
        comments: "0",
      }));

    return { realVideos, realShorts };
  } catch (err) {
    // If DynamoDB is briefly unreachable, fail gracefully rather than
    // breaking the whole homepage — just show the example data instead.
    console.error("Failed to fetch real content for homepage:", err);
    return { realVideos: [], realShorts: [] };
  }
}

interface HomeProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { realVideos, realShorts } = await getRealContent();

  // "horizontal" (default) shows normal 16:9 videos; "vertical" swaps the
  // whole feed to Shorts. Driven by the Horizontal/Vertical chips in the
  // category bar (see NavigationCategories.tsx).
  const { view } = await searchParams;
  const activeView = view === "vertical" ? "vertical" : "horizontal";
  const isVertical = activeView === "vertical";

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
          {/* The cinematic hero + trending row are horizontal-video showcases,
              so they only make sense in the Horizontal view. Vertical view is
              a pure Shorts feed. */}
          {!isVertical && (
            <>
              <FeaturedHero />

              <div className="mx-auto h-px w-[92%] bg-gradient-to-r from-transparent via-white/10 to-transparent light:via-black/10" />

              <TrendingNow />
            </>
          )}

          <RecommendationFeed
            realVideos={realVideos}
            realShorts={realShorts}
            view={activeView}
          />

          {/* Second, static homepage ad slot — its own admin-configurable
              source (Admin Panel -> Advertising -> Homepage Spotlight),
              independent of the banner above. Shown in both Horizontal and
              Vertical (Shorts) views, unlike the hero-row banner above,
              which only makes sense alongside the horizontal showcases. */}
          <AdBanner placement="homepage_spotlight" />
        </div>
      </div>

      <FloatingAIButton />
    </main>
  );
}
