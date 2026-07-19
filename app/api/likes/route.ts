import { NextRequest, NextResponse } from "next/server";
import {
  ScanCommand,
  PutCommand,
  DeleteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

  // Note: the Likes table is keyed by userId first (great for "everything
  // I've liked"), so counting likes for one video means scanning rather
  // than a fast indexed lookup. Perfectly fine at InPlayer's current
  // scale — if this ever needs to handle serious traffic, adding a
  // reverse GSI here (same pattern as Subscriptions) would fix it.
  const countResult = await docClient.send(
    new ScanCommand({
      TableName: "InPlayer-Likes",
      FilterExpression: "videoId = :videoId",
      ExpressionAttributeValues: { ":videoId": videoId },
      Select: "COUNT",
    })
  );

  let isLiked = false;

  try {
    const user = await verifyAuth(request);
    const existing = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Likes",
        Key: { userId: user.userId, videoId },
      })
    );
    isLiked = !!existing.Item;
  } catch {
    // Not signed in — fine, just report as not liked
  }

  return NextResponse.json({
    likeCount: countResult.Count || 0,
    isLiked,
  });
}

export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { videoId, action } = await request.json();

  if (!videoId || !["like", "unlike"].includes(action)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (action === "like") {
    await docClient.send(
      new PutCommand({
        TableName: "InPlayer-Likes",
        Item: {
          userId: user.userId,
          videoId,
          likedAt: new Date().toISOString(),
        },
      })
    );
  } else {
    await docClient.send(
      new DeleteCommand({
        TableName: "InPlayer-Likes",
        Key: { userId: user.userId, videoId },
      })
    );
  }

  return NextResponse.json({ success: true });
}