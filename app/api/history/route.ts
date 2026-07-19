import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

export async function GET(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: "InPlayer-WatchHistory",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": user.userId },
    })
  );

  const history = (result.Items || []).sort(
    (a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime()
  );

  return NextResponse.json({ history });
}

export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { videoId } = await request.json();

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

  // Denormalize the video's display info onto the history record itself,
  // so the History page can render without a second lookup per item.
  const videoResult = await docClient.send(
    new GetCommand({ TableName: "InPlayer-Videos", Key: { videoId } })
  );
  const video = videoResult.Item;

  await docClient.send(
    new PutCommand({
      TableName: "InPlayer-WatchHistory",
      Item: {
        userId: user.userId,
        videoId,
        title: video?.title || "Unknown video",
        thumbnailUrl: video?.thumbnailUrl || "",
        category: video?.category || "",
        watchedAt: new Date().toISOString(),
      },
    })
  );

  return NextResponse.json({ success: true });
}