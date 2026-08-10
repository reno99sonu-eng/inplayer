import { NextRequest, NextResponse } from "next/server";
import { GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { areUsersConnected } from "@/app/lib/connections";
import { normalizeUsername } from "@/app/lib/username";
import { ensureUsername } from "@/app/lib/ensureUsername";

import { selfHealVideoBatch } from "@/app/lib/selfHealVideo";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
      // Fast path missed (no InPlayer-Usernames reservation for this handle).
      // Legacy accounts created before usernameLower existed have no
      // usernameLower attribute at all, so a FilterExpression keyed on it can
      // never match them — that used to make an otherwise-real channel 404.
      // Scan the whole table (same RCU cost a filtered Scan already paid)
      // and match case-insensitively against usernameLower OR the raw
      // username field in memory, paginating like the video lookup below.
      const candidates: Record<string, unknown>[] = [];
      let scanStartKey: Record<string, unknown> | undefined;
      do {
        const page = await docClient.send(
          new ScanCommand({
            TableName: "InPlayer-Users",
            ProjectionExpression: "userId, username, usernameLower",
            ExclusiveStartKey: scanStartKey,
          })
        );
        candidates.push(...(page.Items || []));
        scanStartKey = page.LastEvaluatedKey;
      } while (scanStartKey);

      const match = candidates.find((item) => {
        const handle = (item.usernameLower as string) || (item.username as string);
        return Boolean(handle) && normalizeUsername(handle) === usernameLower;
      });

      if (!match) {
        console.error(`No user found for username: ${usernameLower}`);
        return NextResponse.json({ error: "No channel with that username." }, { status: 404 });
      }

      targetUserId = match.userId as string;

      try {
        await ensureUsername(targetUserId);
      } catch (err) {
        console.error(`Failed to ensure username for userId ${targetUserId}:`, err);
        // Best-effort — the reservation may already exist now.
      }
    }

    const profileResult = await docClient.send(
      new GetCommand({ TableName: "InPlayer-Users", Key: { userId: targetUserId } })
    );
    const profile = profileResult.Item || {};
    
    if (!profileResult.Item) {
      console.error(`No profile found for userId: ${targetUserId}`);
    }
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
      coverPhotoUrl: profile.coverPhotoUrl || null,
      joinedAt:
        profile.createdAt || profile.joinedAt || profile.createdOn || null,
      usernamePrivacy,
      isOwner,
    };

    if (!canViewFull) {
      return NextResponse.json({ ...base, gated: true });
    }

    // InPlayer-Subscriptions really does have a "creatorId-index" GSI (the
    // same one app/api/subscriptions/route.ts and my-videos/analytics use
    // successfully). InPlayer-Videos does NOT have any secondary index —
    // every other working read path (app/lib/videoStore.ts,
    // app/api/my-videos/route.ts) fetches a creator's videos with a
    // paginated Scan+FilterExpression on uploaderId instead. An earlier
    // version of this route queried InPlayer-Videos with
    // IndexName: "creatorId-index" too, which doesn't exist on that table —
    // DynamoDB rejected it with ValidationException every time, which
    // 500'd this whole endpoint and made every channel page show
    // "No channel at @username", even once the username itself resolved
    // correctly. Confirmed via production runtime logs on 2026-07-28.
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
            new ScanCommand({
              TableName: "InPlayer-Videos",
              FilterExpression: "uploaderId = :uid",
              ExpressionAttributeValues: { ":uid": targetUserId },
              ExclusiveStartKey: exclusiveStartKey,
            })
          );
          items.push(...(page.Items || []));
          exclusiveStartKey = page.LastEvaluatedKey;
        } while (exclusiveStartKey);

        const healedItems = await selfHealVideoBatch(items);
        return healedItems;
      })(),
    ]);

    const publicVideos = videosResult.filter(
      (video) =>
        (isOwner || video.status === "ready") &&
        (isOwner || !video.visibility || video.visibility === "public")
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
        muxPlaybackId: v.muxPlaybackId,
      }));

    console.log(`Profile data for ${usernameLower}:`, {
      userId: targetUserId,
      username: profile.username,
      name: profile.name,
      videosCount: videos.length,
      subscriberCount: subscriberCountResult.Count,
      totalViews,
      canViewFull,
      usernamePrivacy,
    });

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
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (err) {
    console.error("Failed to load public profile:", err);
    return NextResponse.json({ error: "Couldn't load that channel right now." }, { status: 500 });
  }
}
