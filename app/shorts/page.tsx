import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import type { Short } from "@/app/data/shorts";
import ShortsPageContent from "@/app/components/ShortsPageContent";

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
      description: video.description,
      creator: video.uploaderName || "Unknown",
      uploaderId: video.uploaderId,
      uploaderAvatarUrl: video.uploaderAvatarUrl,
      poster: video.thumbnailUrl || "/shorts/1.jpg",
      views: `${video.views || 0} views`,
      likes: "0",
      comments: "0",
    }));
  } catch (err) {
    console.error("Failed to fetch shorts:", err);
    return [];
  }
}

export default async function ShortsPage() {
  const shorts = await getShorts();
  return <ShortsPageContent initialShorts={shorts} />;
}