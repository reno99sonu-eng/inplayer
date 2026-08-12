import { NextRequest, NextResponse } from "next/server";
import {
  QueryCommand,
  PutCommand,
  DeleteCommand,
  GetCommand,
  UpdateCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { resolveUsernames } from "@/app/lib/resolveUsernames";
import { resolveActiveMemberIds } from "@/app/lib/memberships";
import { moderateText, UNCHECKED } from "@/app/lib/moderation";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { applyModerationStrike } from "@/app/lib/moderationStrikes";

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

  // The three lookups below don't depend on each other's *results* — only
  // resolveActiveMemberIds needs the video's uploaderId, which is why it's
  // nested inside the video-lookup branch rather than run as a fourth
  // top-level parallel task. Previously these ran as sequential awaits, and
  // isVerified was a per-commenter GetCommand in a loop (a classic N+1 — 10
  // commenters meant 10 extra round trips on every single comment-list
  // load). Now: one parallel batch instead of one round trip per commenter,
  // and independent lookups run concurrently instead of back-to-back.
  const distinctIds = Array.from(new Set(comments.map((c) => c.userId)));

  const [usernames, memberIds, verifiedIds] = await Promise.all([
    // Batched, distinct-userId lookup so each commenter's name can link to
    // their real profile — see app/lib/resolveUsernames. A commenter with
    // no username yet just renders without a link (handled client-side).
    resolveUsernames(comments.map((c) => c.userId)),

    // Real "Member" badge — who among these commenters has an actual,
    // active paid membership with THIS video's creator (see
    // app/lib/memberships). Only fetched if the video still exists and has
    // an uploader; fails to "nobody's a member" rather than breaking
    // comment loading entirely.
    (async () => {
      try {
        const videoResult = await docClient.send(
          new GetCommand({ TableName: "InPlayer-Videos", Key: { videoId }, ProjectionExpression: "uploaderId" })
        );
        const uploaderId = videoResult.Item?.uploaderId as string | undefined;
        if (uploaderId) {
          return await resolveActiveMemberIds(uploaderId, comments.map((c) => c.userId));
        }
      } catch (err) {
        console.error("comments GET: member badge lookup failed:", err);
      }
      return new Set<string>();
    })(),

    // isVerified for every distinct commenter, in one BatchGetCommand
    // (chunked at DynamoDB's 100-key limit) instead of one GetCommand per
    // commenter — same batching idiom as app/lib/resolveUsernames.
    (async () => {
      const verified = new Set<string>();
      if (distinctIds.length === 0) return verified;
      for (let i = 0; i < distinctIds.length; i += 100) {
        const keys = distinctIds.slice(i, i + 100).map((userId) => ({ userId }));
        try {
          let pendingKeys = keys;
          do {
            const result = await docClient.send(
              new BatchGetCommand({
                RequestItems: {
                  "InPlayer-Users": { Keys: pendingKeys, ProjectionExpression: "userId, isVerified" },
                },
              })
            );
            for (const item of result.Responses?.["InPlayer-Users"] || []) {
              if (item.isVerified && typeof item.userId === "string") verified.add(item.userId);
            }
            pendingKeys = (result.UnprocessedKeys?.["InPlayer-Users"]?.Keys || []) as { userId: string }[];
          } while (pendingKeys.length > 0);
        } catch (err) {
          console.error("comments GET: batch isVerified lookup failed:", err);
        }
      }
      return verified;
    })(),
  ]);

  const commentsWithUsernames = comments.map((c) => ({
    ...c,
    userUsername: usernames.get(c.userId),
    isMember: memberIds.has(c.userId),
    isVerified: verifiedIds.has(c.userId),
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

  const { videoId, text, parentUserId } = await request.json();

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
  // moderation API hiccup never blocks a real comment from posting. Skipped
  // entirely (not just ignored) when Admin Panel -> Platform Settings has
  // comment moderation turned off — no OpenAI call is made at all.
  const platformSettings = await getPlatformSettings();
  const moderation = platformSettings.moderationEnabledComments
    ? await moderateText(text.trim())
    : UNCHECKED;

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

  // Keep InPlayer-Videos.commentCount in sync so homepage/channel/Raftaar
  // cards can show a real count straight off the already-fetched video
  // record — but only for comments the public can actually see (a
  // moderation-hidden comment below shouldn't count towards a number
  // viewers see displayed).
  if (!comment.hidden) {
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId },
          UpdateExpression: "SET commentCount = if_not_exists(commentCount, :zero) + :inc",
          ExpressionAttributeValues: { ":inc": 1, ":zero": 0 },
        })
      );
    } catch (err) {
      console.error("Failed to update video commentCount:", err);
    }
  }

  // Flagged comments are hidden and go straight to the Admin Panel's
  // moderation queue instead of notifying the video owner — no point
  // pinging them about something nobody else can see yet. They also count
  // against the poster's 3-strike record (app/lib/moderationStrikes.ts).
  if (comment.hidden) {
    await applyModerationStrike(request, user.userId, "comment", moderation.categories).catch((err) =>
      console.error("comments: applyModerationStrike failed:", err)
    );
    return NextResponse.json({ comment, flagged: true });
  }

  // Notify the video owner and/or parent comment author
  try {
    const videoResult = await docClient.send(
      new GetCommand({ TableName: "InPlayer-Videos", Key: { videoId } })
    );
    const video = videoResult.Item;
    const preview = text.trim().length > 60 ? text.trim().slice(0, 60) + "..." : text.trim();

    if (parentUserId && parentUserId !== user.userId) {
      await docClient.send(
        new PutCommand({
          TableName: "InPlayer-Notifications",
          Item: {
            userId: parentUserId,
            notificationId: randomUUID(),
            type: "comment_reply",
            message: `${user.name || "Someone"} replied to your comment on "${video?.title || "video"}": "${preview}"`,
            videoId,
            read: false,
            createdAt: new Date().toISOString(),
          },
        })
      );
    } else if (video && video.uploaderId !== user.userId) {
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

  // Mirror the same non-hidden-only rule POST uses above — a hidden
  // comment was never counted in commentCount in the first place, so
  // deleting it must not decrement the count either.
  if (!existing.Item.hidden) {
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId },
          UpdateExpression: "SET commentCount = if_not_exists(commentCount, :zero) - :dec",
          ExpressionAttributeValues: { ":dec": 1, ":zero": 0 },
        })
      );
    } catch (err) {
      console.error("Failed to update video commentCount:", err);
    }
  }

  return NextResponse.json({ success: true });
}