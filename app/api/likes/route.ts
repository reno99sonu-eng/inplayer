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
import { sendPushToUser } from "@/app/lib/push";
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

  const body = await request.json();
  const { videoId, seriesId } = body;
  const rawAction = body.action;
  const action = rawAction === "unlike" ? "remove" : rawAction;

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

        if (video && (video.uploaderId || video.creatorId) !== user.userId) {
          const ownerId = video.uploaderId || video.creatorId;
          const likeMessage = `${user.name || "Someone"} liked your video "${video.title}"`;
          await docClient.send(
            new PutCommand({
              TableName: "InPlayer-Notifications",
              Item: {
                userId: ownerId,
                notificationId: randomUUID(),
                type: "like",
                message: likeMessage,
                videoId,
                read: false,
                createdAt: new Date().toISOString(),
              },
            })
          );
          void sendPushToUser({ userId: ownerId as string, title: "INPLAYER", body: likeMessage });
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
  let updatedLikeCount = 0;

  if (likeCountDelta !== 0) {
    try {
      const updateResult = await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId },
          UpdateExpression: "SET likeCount = if_not_exists(likeCount, :zero) + :delta, #likes = if_not_exists(#likes, :zero) + :delta",
          ExpressionAttributeNames: { "#likes": "likes" },
          ExpressionAttributeValues: { ":delta": likeCountDelta, ":zero": 0 },
          ReturnValues: "ALL_NEW",
        })
      );

      const updatedVideo = updateResult.Attributes;
      if (updatedVideo) {
        updatedLikeCount = Number(updatedVideo.likeCount ?? updatedVideo.likes) || 0;

        // If this is a film episode with a seriesId, increment series totalLikes
        const targetSeriesId = updatedVideo.seriesId || seriesId;
        if (targetSeriesId) {
          try {
            const { incrementSeriesStats } = await import("@/app/lib/raftaarFilms");
            await incrementSeriesStats(targetSeriesId, "totalLikes", likeCountDelta);
          } catch (seriesErr) {
            console.error("Failed to update series totalLikes:", seriesErr);
          }
        }

        // Also keep creator's totalLikes updated
        const uploaderId = updatedVideo.uploaderId || updatedVideo.creatorId;
        if (uploaderId) {
          try {
            await docClient.send(
              new UpdateCommand({
                TableName: "InPlayer-Users",
                Key: { userId: uploaderId },
                UpdateExpression: "SET totalLikes = if_not_exists(totalLikes, :zero) + :delta",
                ExpressionAttributeValues: { ":delta": likeCountDelta, ":zero": 0 },
              })
            );
          } catch (userErr) {
            console.error("Failed to update user totalLikes:", userErr);
          }
        }
      }
    } catch (err) {
      console.error("Failed to update video likeCount:", err);
    }
  }

  return NextResponse.json({
    success: true,
    likeCount: updatedLikeCount,
    myReaction: isLike ? "like" : (action === "dislike" ? "dislike" : null),
  });
}