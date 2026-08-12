import { GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { areUsersConnected } from "@/app/lib/connections";
import { normalizeUsername } from "@/app/lib/username";
import { ensureUsername } from "@/app/lib/ensureUsername";
import { selfHealVideoBatch } from "@/app/lib/selfHealVideo";

export interface PublicProfileVideo {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  views: number;
  likeCount: number;
  commentCount: number;
  uploadedAt: string;
  contentType: string;
  category?: string;
  muxPlaybackId?: string;
}

export interface PublicProfileData {
  found: true;
  userId: string;
  username: string;
  avatarUrl: string | null;
  coverPhotoUrl: string | null;
  joinedAt: string | null;
  usernamePrivacy: "public" | "private" | "connections";
  isOwner: boolean;
  gated: boolean;
  name?: string;
  description?: string;
  isVerified?: boolean;
  socialLinks?: { social: Record<string, string>; other: { label: string; url: string }[] };
  subscriberCount?: number;
  totalViews?: number;
  videos?: PublicProfileVideo[];
}

export type GetPublicProfileResult =
  | { ok: true; data: PublicProfileData }
  | { ok: false; status: number; error: string };

// Shared by app/api/users/[username]/route.ts (the client's authenticated
// fetch, via a Bearer token that only a browser can supply) AND
// app/u/[username]/page.tsx (the anonymous, server-rendered first paint —
// a Next.js Server Component has no Authorization header to read, so it
// always calls this with viewerId: null). Kept as one function, not two
// copies, so privacy gating / video filtering can never drift between the
// SSR pass and the client's own re-fetch.
export async function getPublicProfile(
  usernameRaw: string,
  viewerId: string | null
): Promise<GetPublicProfileResult> {
  const usernameLower = normalizeUsername(decodeURIComponent(usernameRaw));

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
        return { ok: false, status: 404, error: "No channel with that username." };
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
      found: true as const,
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
      return { ok: true, data: { ...base, gated: true } };
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
              // Fall back to userId when uploaderId doesn't match — some
              // rows predate the uploaderId rename and only have userId set
              // (same defensive OR pattern already used in
              // app/api/admin/creators/route.ts's v.uploaderId || v.userId
              // fallback), so those videos weren't showing up on the
              // owning user's own public channel page.
              FilterExpression: "uploaderId = :uid OR userId = :uid",
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
    const videos: PublicProfileVideo[] = publicVideos
      .sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0))
      .map((v) => ({
        videoId: v.videoId as string,
        title: v.title as string,
        thumbnailUrl: v.thumbnailUrl as string | undefined,
        views: (v.views as number) || 0,
        likeCount: (v.likeCount as number) || 0,
        commentCount: (v.commentCount as number) || 0,
        uploadedAt: v.uploadedAt as string,
        contentType: (v.contentType as string) || "video",
        category: v.category as string | undefined,
        muxPlaybackId: v.muxPlaybackId as string | undefined,
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

    return {
      ok: true,
      data: {
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
      },
    };
  } catch (err) {
    console.error("Failed to load public profile:", err);
    return { ok: false, status: 500, error: "Couldn't load that channel right now." };
  }
}
