import { NextRequest, NextResponse } from "next/server";
import {
  QueryCommand,
  PutCommand,
  DeleteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { resolveUsernames } from "@/app/lib/resolveUsernames";
import { resolveActiveMemberIds } from "@/app/lib/memberships";
import { moderateText } from "@/app/lib/moderation";

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: "InPlayer-Comments",
      KeyConditionExpression: "videoId = :videoId",
      ExpressionAttributeValues: { ":videoId": videoId },
    })
  );

  // Auto-flagged comments (see moderateText in POST below) are hidden from
  // everyone here — including the person who posted them — until an admin
  // clears them in the Admin Panel's moderation queue. The poster still
  // finds out immediately: POST's own response below tells them right when
  // they submit it, before this GET is ever involved.
  const comments = (result.Items || [])
    .filter((c) => c.hidden !== true)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Batched, distinct-userId lookup so each commenter's name can link to
  // their real profile — see app/lib/resolveUsernames. A commenter with
  // no username yet just renders without a link (handled client-side).
  const usernames = await resolveUsernames(comments.map((c) => c.userId));

  // Real "Member" badge — who among these commenters has an actual, active
  // paid membership with THIS video's creator (see app/lib/memberships).
  // Only fetched if the video still exists and has an uploader; fails to
  // "nobody's a member" rather than breaking comment loading entirely.
  let memberIds = new Set<string>();
  try {
    const videoResult = await docClient.send(
      new GetCommand({ TableName: "InPlayer-Videos", Key: { videoId }, ProjectionExpression: "uploaderId" })
    );
    const uploaderId = videoResult.Item?.uploaderId as string | undefined;
    if (uploaderId) {
      memberIds = await resolveActiveMemberIds(uploaderId, comments.map((c) => c.userId));
    }
  } catch (err) {
    console.error("comments GET: member badge lookup failed:", err);
  }

  const commentsWithUsernames = comments.map((c) => ({
    ...c,
    userUsername: usernames.get(c.userId),
    isMember: memberIds.has(c.userId),
  }));

  return NextResponse.json({ comments: commentsWithUsernames });
}

export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in to comment." }, { status: 401 });
  }

  const { videoId, text } = await request.json();

  if (!videoId || !text?.trim()) {
    return NextResponse.json({ error: "Comment text is required." }, { status: 400 });
  }

  if (text.length > 1000) {
    return NextResponse.json({ error: "Comment is too long." }, { status: 400 });
  }

  // Snapshot the commenter's current avatar so the comment list can show
  // it without an extra lookup per comment. app/api/profile/sync keeps
  // this in sync if they change their photo later.
  const profileResult = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Users",
      Key: { userId: user.userId },
    })
  );
  const userAvatarUrl = profileResult.Item?.avatarUrl || null;

  // Real-time auto-moderation (app/lib/moderation.ts) — fails open, so a
  // moderation API hiccup never blocks a real comment from posting.
  const moderation = await moderateText(text.trim());

  const comment = {
    videoId,
    commentId: randomUUID(),
    userId: user.userId,
    userName: user.name || "Anonymous",
    userAvatarUrl,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    ...(moderation.checked &&
      moderation.flagged && {
        flagged: true,
        flaggedCategories: moderation.categories,
        hidden: true,
        moderatedAt: new Date().toISOString(),
      }),
  };

  await docClient.send(
    new PutCommand({
      TableName: "InPlayer-Comments",
      Item: comment,
    })
  );

  // Flagged comments are hidden and go straight to the Admin Panel's
  // moderation queue instead of notifying the video owner — no point
  // pinging them about something nobody else can see yet.
  if (comment.hidden) {
    return NextResponse.json({ comment, flagged: true });
  }

  // Notify the video owner, unless they're commenting on their own video
  try {
    const videoResult = await docClient.send(
      new GetCommand({ TableName: "InPlayer-Videos", Key: { videoId } })
    );
    const video = videoResult.Item;

    if (video && video.uploaderId !== user.userId) {
      const preview =
        text.trim().length > 60 ? text.trim().slice(0, 60) + "..." : text.trim();

      await docClient.send(
        new PutCommand({
          TableName: "InPlayer-Notifications",
          Item: {
            userId: video.uploaderId,
            notificationId: randomUUID(),
            type: "comment",
            message: `${user.name || "Someone"} commented on your video "${video.title}": "${preview}"`,
            videoId,
            read: false,
            createdAt: new Date().toISOString(),
          },
        })
      );
    }
  } catch (err) {
    console.error("Failed to write comment notification:", err);
  }

  return NextResponse.json({ comment });
}

export async function DELETE(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const videoId = request.nextUrl.searchParams.get("videoId");
  const commentId = request.nextUrl.searchParams.get("commentId");

  if (!videoId || !commentId) {
    return NextResponse.json(
      { error: "videoId and commentId are required." },
      { status: 400 }
    );
  }

  const existing = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Comments",
      Key: { videoId, commentId },
    })
  );

  if (!existing.Item) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  }

  if (existing.Item.userId !== user.userId) {
    return NextResponse.json(
      { error: "You can only delete your own comments." },
      { status: 403 }
    );
  }

  await docClient.send(
    new DeleteCommand({
      TableName: "InPlayer-Comments",
      Key: { videoId, commentId },
    })
  );

  return NextResponse.json({ success: true });
}