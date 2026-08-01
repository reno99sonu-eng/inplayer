import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

export async function GET(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: "InPlayer-Likes",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": user.userId },
      })
    );

    const items = result.Items || [];
    const likedItems = items
      .filter((i) => i.reaction === "like")
      .sort((a, b) => new Date(b.reactedAt || 0).getTime() - new Date(a.reactedAt || 0).getTime());

    const videos = await Promise.all(
      likedItems.map(async (item) => {
        try {
          const videoRes = await docClient.send(
            new GetCommand({
              TableName: "InPlayer-Videos",
              Key: { videoId: item.videoId },
            })
          );
          if (!videoRes.Item) return null;
          return {
            ...videoRes.Item,
            likedAt: item.reactedAt,
          };
        } catch {
          return null;
        }
      })
    );

    const validVideos = videos.filter(Boolean);

    return NextResponse.json({ videos: validVideos });
  } catch (err) {
    console.error("Failed to load liked videos:", err);
    return NextResponse.json({ videos: [] });
  }
}
