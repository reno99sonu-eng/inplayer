import { NextRequest, NextResponse } from "next/server";
import { GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { areUsersConnected } from "@/app/lib/connections";
import { normalizeUsername } from "@/app/lib/username";

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

    if (!handleResult.Item) {
      return NextResponse.json({ error: "No channel with that username." }, { status: 404 });
    }

    const targetUserId = handleResult.Item.userId as string;

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
      username: profile.username || handleResult.Item.username,
      avatarUrl: profile.avatarUrl || null,
      usernamePrivacy,
      isOwner,
    };

    if (!canViewFull) {
      return NextResponse.json({ ...base, gated: true });
    }

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
      docClient.send(
        new ScanCommand({
          TableName: "InPlayer-Videos",
          FilterExpression:
            "uploaderId = :uid AND #status = :ready AND (attribute_not_exists(visibility) OR visibility = :pub)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":uid": targetUserId,
            ":ready": "ready",
            ":pub": "public",
          },
        })
      ),
    ]);

    const videos = (videosResult.Items || [])
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(0, 24)
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
      subscriberCount: subscriberCountResult.Count || 0,
      videos,
    });
  } catch (err) {
    console.error("Failed to load public profile:", err);
    return NextResponse.json({ error: "Couldn't load that channel right now." }, { status: 500 });
  }
}
