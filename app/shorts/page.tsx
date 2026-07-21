import { getReadyVideos } from "@/app/lib/videoStore";
import type { Short } from "@/app/data/shorts";
import ShortsPageContent from "@/app/components/ShortsPageContent";

export const dynamic = "force-dynamic";

interface ShortsPageProps {
  // Next.js 13+ App Router passes searchParams as a Promise. `v` is an
  // optional videoId — set when arriving from a link to one specific
  // short (e.g. the homepage Shorts shelf), so that short opens first
  // instead of always starting from the top of the feed.
  searchParams: Promise<{ v?: string }>;
}

async function getShorts(startVideoId?: string): Promise<Short[]> {
  try {
    // Shared 30-second cached list (see lib/videoStore) — no per-request
    // table Scan. Already sorted newest-first.
    const items = (await getReadyVideos()).filter(
      (video) =>
        video.contentType === "short" &&
        (!video.visibility || video.visibility === "public")
    );

    const mapped = items.map((video) => ({
      id: video.videoId,
      videoId: video.videoId,
      muxPlaybackId: video.muxPlaybackId,
      title: video.title,
      description: video.description,
      creator: video.uploaderName || "Unknown",
      uploaderId: video.uploaderId,
      uploaderAvatarUrl: video.uploaderAvatarUrl,
      poster: video.thumbnailUrl || "/shorts/1.jpg",
      views: `${video.views || 0} views`,
      likes: "0",
      comments: "0",
    }));

    // Move the requested short to the front so the feed opens on it
    // directly, instead of always starting from the newest upload.
    if (startVideoId) {
      const index = mapped.findIndex((s) => s.videoId === startVideoId);
      if (index > 0) {
        const [target] = mapped.splice(index, 1);
        mapped.unshift(target);
      }
    }

    return mapped;
  } catch (err) {
    console.error("Failed to fetch shorts:", err);
    return [];
  }
}

export default async function ShortsPage({ searchParams }: ShortsPageProps) {
  const { v } = await searchParams;
  const shorts = await getShorts(v);
  return <ShortsPageContent initialShorts={shorts} />;
}