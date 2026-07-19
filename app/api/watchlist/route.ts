import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

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
    await docClient.send(
      new PutCommand({
        TableName: "InPlayer-Watchlist",
        Item: {
          userId: user.userId,
          videoId,
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