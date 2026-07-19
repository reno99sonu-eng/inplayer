import Hero from "./components/Hero";
import ContinueWatching from "./components/ContinueWatching";
import TrendingNow from "./components/TrendingNow";
import FloatingAIButton from "./components/FloatingAIButton";
import FeaturedHero from "./components/featuredHero/FeaturedHero";
import RecommendationFeed from "./components/RecommendationFeed";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./lib/dynamodb";
import type { Recommendation } from "./data/recommendations";
import type { Short } from "./data/shorts";

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
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        FilterExpression: "#status = :ready",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":ready": "ready" },
      })
    );

    const items = result.Items || [];

    // Newest uploads first
    items.sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    const realVideos: Recommendation[] = items
      .filter((video) => video.contentType !== "short")
      .map((video) => ({
        id: video.videoId,
        videoId: video.videoId,
        title: video.title,
        creator: video.uploaderName || "Unknown",
        avatar: "/avatars/avatar.png",
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
        creator: video.uploaderName || "Unknown",
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

export default async function Home() {
  const { realVideos, realShorts } = await getRealContent();

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#050816] light:bg-white">
      {/* Premium Background */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Dark Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#04060F] via-[#091224] to-[#04060F] light:from-white light:via-slate-50 light:to-white" />

        {/* Honeycomb Texture — Dark Mode */}
        <div
          className="absolute inset-0 opacity-[0.06] light:hidden"
          style={{
            backgroundImage:
              "radial-gradient(circle at 24px 24px, rgba(255,176,59,0.18) 2px, transparent 2px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Honeycomb Texture — Light Mode (tuned to actually be visible on white) */}
        <div
          className="absolute inset-0 hidden light:block"
          style={{
            backgroundImage:
              "radial-gradient(circle at 24px 24px, rgba(249,115,22,0.35) 2px, transparent 2px)",
            backgroundSize: "48px 48px",
            opacity: 0.12,
          }}
        />

        {/* Orange Ambient Glow */}
        <div className="absolute -left-64 top-20 h-[600px] w-[600px] rounded-full bg-orange-500/10 blur-[180px]" />

        {/* Blue Ambient Glow */}
        <div className="absolute -right-64 bottom-0 h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[180px]" />
      </div>

      <div className="relative z-10">
        <div className="space-y-1 lg:space-y-2">
        <FeaturedHero />

<div className="mx-auto h-px w-[92%] bg-gradient-to-r from-transparent via-white/10 to-transparent light:via-slate-200" />

<TrendingNow />

<div className="mx-auto h-px w-[92%] bg-gradient-to-r from-transparent via-white/10 to-transparent light:via-slate-200" />

<RecommendationFeed realVideos={realVideos} realShorts={realShorts} />

        {/* <ContinueWatching /> */}
        </div>
      </div>

      <FloatingAIButton />
    </main>
  );
}
