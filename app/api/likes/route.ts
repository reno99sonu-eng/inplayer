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

  // Note: the table is keyed by userId first (great for "everything I've
  // liked"), so counting reactions for one video means scanning rather
  // than a fast indexed lookup. Fine at InPlayer's current scale — a
  // reverse GSI (same pattern as Subscriptions) would fix this later.
  const result = await docClient.send(
    new ScanCommand({
      TableName: "InPlayer-Likes",
      FilterExpression: "videoId = :videoId",
      ExpressionAttributeValues: { ":videoId": videoId },
    })
  );

  const items = result.Items || [];
  const likeCount = items.filter((i) => i.reaction === "like").length;
  const dislikeCount = items.filter((i) => i.reaction === "dislike").length;

  let myReaction: "like" | "dislike" | null = null;

  try {
    const user = await verifyAuth(request);
    const existing = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Likes",
        Key: { userId: user.userId, videoId },
      })
    );
    myReaction = (existing.Item?.reaction as "like" | "dislike") || null;
  } catch {
    // Not signed in — fine, just report as no reaction
  }

  return NextResponse.json({ likeCount, dislikeCount, myReaction });
}

export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { videoId, action } = await request.json();

  if (!videoId || !["like", "dislike", "remove"].includes(action)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (action === "remove") {
    await docClient.send(
      new DeleteCommand({
        TableName: "InPlayer-Likes",
        Key: { userId: user.userId, videoId },
      })
    );
  } else {
    await docClient.send(
      new PutCommand({
        TableName: "InPlayer-Likes",
        Item: {
          userId: user.userId,
          videoId,
          reaction: action,
          reactedAt: new Date().toISOString(),
        },
      })
    );
  }

  return NextResponse.json({ success: true });
}