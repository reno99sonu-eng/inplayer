import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import type { Short } from "@/app/data/shorts";
import ShortsPageContent from "@/app/components/ShortsPageContent";

// Same fix as app/page.tsx and app/videos/page.tsx: without this, Next.js
// statically generates this page at build time and newly uploaded shorts
// never show up here until the next deploy.
export const dynamic = "force-dynamic";

async function getShorts(): Promise<Short[]> {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        FilterExpression: "#status = :ready",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":ready": "ready" },
      })
    );

    const items = (result.Items || [])
      .filter((video) => video.contentType === "short")
      .sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );

    return items.map((video) => ({
      id: video.videoId,
      videoId: video.videoId,
      muxPlaybackId: video.muxPlaybackId,
      title: video.title,
      creator: video.uploaderName || "Unknown",
      uploaderId: video.uploaderId,
      uploaderAvatarUrl: video.uploaderAvatarUrl,
      poster: video.thumbnailUrl || "/shorts/1.jpg",
      views: `${video.views || 0} views`,
      // Real like/comment counts are fetched live per-slide in
      // ShortsPageContent (same as the watch page) — these are just
      // placeholders until that first fetch resolves.
      likes: "0",
      comments: "0",
    }));
  } catch (err) {
    // If DynamoDB is briefly unreachable, fail gracefully with an empty
    // feed rather than breaking the whole page.
    console.error("Failed to fetch shorts:", err);
    return [];
  }
}

export default async function ShortsPage() {
  const shorts = await getShorts();

  return <ShortsPageContent initialShorts={shorts} />;
}
