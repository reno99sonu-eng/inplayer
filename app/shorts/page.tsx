import { getReadyVideos } from "@/app/lib/videoStore";
import type { Short } from "@/app/data/shorts";
import ShortsPageContent from "@/app/components/ShortsPageContent";
import { resolveUsernames } from "@/app/lib/resolveUsernames";

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

    // Resolved once for the whole page in a single batched call (distinct
    // uploaderIds only) — see app/lib/resolveUsernames — rather than once
    // per short, so the channel name in the feed can link to a real
    // profile.
    const usernames = await resolveUsernames(
      items.map((v) => v.uploaderId as string | null | undefined)
    );

    const mapped = items.map((video) => {
      const videoId = video.videoId as string;
      const uploaderId = video.uploaderId as string | undefined;
      // Loosely-shaped, only-known-at-a-point structure stored on the raw
      // DynamoDB item — cast just the fields this feed actually reads,
      // matching the real shape of app/data/shorts.ts's Short soundtrack
      // fields.
      const shortSettings = video.shortSettings as
        | {
            soundtrack?: Short["soundtrack"];
            soundtrackId?: string | null;
            musicClipSeconds?: 20 | 30;
            filter?: Short["filter"];
          }
        | undefined;

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
        likes: `${(video.likeCount as number) || 0} likes`,
        comments: `${(video.commentCount as number) || 0} comments`,
        soundtrack: shortSettings?.soundtrack ?? null,
        soundtrackId: shortSettings?.soundtrackId ?? null,
        musicClipSeconds: (shortSettings?.musicClipSeconds === 20
          ? 20
          : 30) as 20 | 30,
        // The "Look" picked in ShortCreationTools at upload time — was
        // stored server-side (see app/api/upload/create/route.ts) but never
        // read back out anywhere, so it was captured then silently
        // discarded. Applied as a real CSS filter on the <video> element in
        // ShortsPageContent.tsx.
        filter: (shortSettings?.filter as Short["filter"]) ?? "original",
      };
    });

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