import { NextRequest, NextResponse } from "next/server";
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");

  // No videoId given — return the full watchlist for the signed-in user
  if (!videoId) {
    let user;

    try {
      user = await verifyAuth(request);
    } catch {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const result = await docClient.send(
      new QueryCommand({
        TableName: "InPlayer-Watchlist",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": user.userId },
      })
    );

    const items = (result.Items || []).sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    );

    return NextResponse.json({ items });
  }

  // videoId given — single status check (used by the Watch Later button)
  let inWatchlist = false;

  try {
    const user = await verifyAuth(request);
    const existing = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Watchlist",
        Key: { userId: user.userId, videoId },
      })
    );
    inWatchlist = !!existing.Item;
  } catch {
    // Not signed in — fine, just report as not saved
  }

  return NextResponse.json({ inWatchlist });
}

export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { videoId, action } = await request.json();

  if (!videoId || !["add", "remove"].includes(action)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (action === "add") {
    // Denormalize the video's display info onto the watchlist record,
    // so the Watchlist page can render without a second lookup per item.
    const videoResult = await docClient.send(
      new GetCommand({ TableName: "InPlayer-Videos", Key: { videoId } })
    );
    const video = videoResult.Item;

    await docClient.send(
      new PutCommand({
        TableName: "InPlayer-Watchlist",
        Item: {
          userId: user.userId,
          videoId,
          title: video?.title || "Unknown video",
          thumbnailUrl: video?.thumbnailUrl || "",
          category: video?.category || "",
          addedAt: new Date().toISOString(),
        },
      })
    );
  } else {
    await docClient.send(
      new DeleteCommand({
        TableName: "InPlayer-Watchlist",
        Key: { userId: user.userId, videoId },
      })
    );
  }

  return NextResponse.json({ success: true });
}