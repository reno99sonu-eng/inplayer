import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { filterListByAudience } from "@/app/lib/contentAccessServer";

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

  const sorted = (result.Items || []).sort(
    (a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime()
  );

  // Watch History is a saved snapshot per row (title/thumbnail copied at
  // watch time), so it carries no audience of its own — resolved against
  // the shared cached video list instead. Without this, history would list
  // exactly the titles Kids mode and a hidden-18+ setting are meant to
  // hide, on a device someone else may have set those modes for.
  const history = await filterListByAudience(
    sorted,
    (item) => item.videoId as string | undefined
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
        contentType: video?.contentType || "video",
        watchedAt: new Date().toISOString(),
      },
    })
  );

  return NextResponse.json({ success: true });
}