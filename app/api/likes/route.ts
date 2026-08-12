import { NextRequest, NextResponse } from "next/server";
import {
  ScanCommand,
  PutCommand,
  DeleteCommand,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
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

  // Read the prior reaction first so the denormalized likeCount on
  // InPlayer-Videos (see app/api/upload/create/route.ts) can be adjusted by
  // exactly the right delta below — homepage/channel/Raftaar cards read
  // that field directly instead of re-scanning InPlayer-Likes per card.
  const priorResult = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Likes",
      Key: { userId: user.userId, videoId },
    })
  );
  const previousReaction = (priorResult.Item?.reaction as "like" | "dislike" | undefined) || null;

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

    // Notify the video owner — but only for a genuine "like" (not
    // dislike), and only if it's not their own video.
    if (action === "like") {
      try {
        const videoResult = await docClient.send(
          new GetCommand({ TableName: "InPlayer-Videos", Key: { videoId } })
        );
        const video = videoResult.Item;

        if (video && video.uploaderId !== user.userId) {
          await docClient.send(
            new PutCommand({
              TableName: "InPlayer-Notifications",
              Item: {
                userId: video.uploaderId,
                notificationId: randomUUID(),
                type: "like",
                message: `${user.name || "Someone"} liked your video "${video.title}"`,
                videoId,
                read: false,
                createdAt: new Date().toISOString(),
              },
            })
          );
        }
      } catch (err) {
        // A notification failing to write shouldn't break the like itself
        console.error("Failed to write like notification:", err);
      }
    }
  }

  // Keep InPlayer-Videos.likeCount in sync with exactly what just happened
  // — +1 only when this action newly makes it a "like" that wasn't one
  // before, -1 only when it stops being a "like". Every other transition
  // (e.g. dislike -> dislike, or a fresh dislike with no prior reaction)
  // nets to a real delta of 0, so this never drifts from the true count.
  const wasLike = previousReaction === "like";
  const isLike = action === "like";
  const likeCountDelta = (isLike ? 1 : 0) - (wasLike ? 1 : 0);
  if (likeCountDelta !== 0) {
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId },
          UpdateExpression: "SET likeCount = if_not_exists(likeCount, :zero) + :delta",
          ExpressionAttributeValues: { ":delta": likeCountDelta, ":zero": 0 },
        })
      );
    } catch (err) {
      // A counter drifting slightly on a rare failure is far better than a
      // 500 on the like action a viewer is actively waiting on.
      console.error("Failed to update video likeCount:", err);
    }
  }

  return NextResponse.json({ success: true });
}