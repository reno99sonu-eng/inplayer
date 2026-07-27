import { NextRequest, NextResponse } from "next/server";
import { GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { areUsersConnected } from "@/app/lib/connections";
import { normalizeUsername } from "@/app/lib/username";
import { ensureUsername } from "@/app/lib/ensureUsername";

interface Params {
  params: Promise<{ username: string }>;
}

// A user's public channel (app/u/[username]) — optional auth, like
// browsing a video: signed-out visitors can view public profiles, but
// privacy gating (private / connections-only) needs to know who's asking.
export async function GET(request: NextRequest, { params }: Params) {
  const { username } = await params;
  const usernameLower = normalizeUsername(decodeURIComponent(username));

  let viewerId: string | null = null;
  try {
    const viewer = await verifyAuth(request);
    viewerId = viewer.userId;
  } catch {
    // Not signed in — fine, this endpoint works for anonymous visitors too.
  }

  try {
    const handleResult = await docClient.send(
      new GetCommand({ TableName: "InPlayer-Usernames", Key: { usernameLower } })
    );

    let targetUserId: string | null = handleResult.Item?.userId ?? null;

    if (!targetUserId) {
      const scanResult = await docClient.send(
        new ScanCommand({
          TableName: "InPlayer-Users",
          FilterExpression: "usernameLower = :usernameLower",
          ExpressionAttributeValues: { ":usernameLower": usernameLower },
        })
      );

      if (!scanResult.Items || scanResult.Items.length === 0) {
        return NextResponse.json({ error: "No channel with that username." }, { status: 404 });
      }

      targetUserId = scanResult.Items[0].userId as string;

      try {
        await ensureUsername(targetUserId);
      } catch {
        // Best-effort — the reservation may already exist now.
      }
    }

    const profileResult = await docClient.send(
      new GetCommand({ TableName: "InPlayer-Users", Key: { userId: targetUserId } })
    );
    const profile = profileResult.Item || {};
    const usernamePrivacy = profile.usernamePrivacy || "public";
    const isOwner = viewerId === targetUserId;

    let canViewFull = isOwner || usernamePrivacy === "public";
    if (!canViewFull && usernamePrivacy === "connections" && viewerId) {
      canViewFull = await areUsersConnected(viewerId, targetUserId);
    }

    const base = {
      found: true,
      userId: targetUserId,
      username: profile.username || handleResult.Item?.username,
      avatarUrl: profile.avatarUrl || null,
      joinedAt:
        profile.createdAt || profile.joinedAt || profile.createdOn || null,
      usernamePrivacy,
      isOwner,
    };

    if (!canViewFull) {
      return NextResponse.json({ ...base, gated: true });
    }

    // Both reads use existing creatorId indexes. The video lookup used to
    // Scan the full table and filter it afterwards; a channel must never get
    // slower as unrelated creators upload more videos.
    const [subscriberCountResult, videosResult] = await Promise.all([
      docClient.send(
        new QueryCommand({
          TableName: "InPlayer-Subscriptions",
          IndexName: "creatorId-index",
          KeyConditionExpression: "creatorId = :creatorId",
          ExpressionAttributeValues: { ":creatorId": targetUserId },
          Select: "COUNT",
        })
      ),
      (async () => {
        const items: Record<string, unknown>[] = [];
        let exclusiveStartKey: Record<string, unknown> | undefined;

        do {
          const page = await docClient.send(
            new QueryCommand({
              TableName: "InPlayer-Videos",
              IndexName: "creatorId-index",
              KeyConditionExpression: "uploaderId = :uid",
              ExpressionAttributeValues: { ":uid": targetUserId },
              ExclusiveStartKey: exclusiveStartKey,
            })
          );
          items.push(...(page.Items || []));
          exclusiveStartKey = page.LastEvaluatedKey;
        } while (exclusiveStartKey);

        return items;
      })(),
    ]);

    const publicVideos = videosResult.filter(
      (video) =>
        video.status === "ready" &&
        (!video.visibility || video.visibility === "public")
    );
    const totalViews = publicVideos.reduce(
      (sum, video) => sum + (Number(video.views) || 0),
      0
    );
    const videos = publicVideos
      .sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0))
      .map((v) => ({
        videoId: v.videoId,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        views: v.views || 0,
        uploadedAt: v.uploadedAt,
        contentType: v.contentType || "video",
      }));

    return NextResponse.json({
      ...base,
      gated: false,
      socialLinks: profile.socialLinks || { social: {}, other: [] },
      name: profile.name || profile.username || handleResult.Item?.username,
      description: profile.description || profile.bio || "",
      isVerified: Boolean(
        profile.verified || profile.isVerified || profile.creatorVerified
      ),
      subscriberCount: subscriberCountResult.Count || 0,
      totalViews,
      videos,
    });
  } catch (err) {
    console.error("Failed to load public profile:", err);
    return NextResponse.json({ error: "Couldn't load that channel right now." }, { status: 500 });
  }
}
