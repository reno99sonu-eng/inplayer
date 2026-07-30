import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { isActiveMember } from "@/app/lib/memberships";
import mux, { signPlaybackToken } from "@/app/lib/mux";

interface Params {
  params: Promise<{ videoId: string }>;
}

// This is the ONLY way a "Members only" video's real, signed playback ID
// ever leaves the server. The public watch page never receives it for a
// members-only video — see app/watch/[videoId]/page.tsx and
// WatchPageContent, which for a members-only video render a locked state
// and call this route (with the viewer's own auth token) to get playable
// details, instead of the ordinary "playback details already in the SSR
// payload" path every other video uses. Unlike the app-level "hide the
// player" checks elsewhere in InPlayer, this is real access control: the
// signed playback ID this hands back is worthless without the token that
// comes with it, and that token is only ever issued after the checks below
// actually pass.
export async function GET(request: NextRequest, { params }: Params) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { videoId } = await params;

  const result = await docClient.send(
    new GetCommand({ TableName: "InPlayer-Videos", Key: { videoId } })
  );
  const video = result.Item;

  if (!video || video.status !== "ready" || video.moderationHidden === true) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  if (!video.membersOnly) {
    // Not what this route is for — the caller should just use the public
    // muxPlaybackId already in the video's normal payload.
    return NextResponse.json(
      { error: "This video isn't members-only." },
      { status: 400 }
    );
  }

  const isOwner = video.uploaderId === user.userId;
  const isMember = isOwner ? false : await isActiveMember(user.userId, video.uploaderId);

  if (!isOwner && !isMember) {
    return NextResponse.json(
      { error: "This video is for paid members only.", reason: "members_only" },
      { status: 403 }
    );
  }

  let signedPlaybackId = video.muxSignedPlaybackId as string | undefined;

  // Self-heal: a video published before this feature existed (or before
  // "Members only" was ever toggled on for it) won't have a signed
  // playback ID yet, only the original public one. Add one now, on demand,
  // rather than leaving the creator's own already-published video stuck.
  if (!signedPlaybackId && video.muxAssetId) {
    try {
      const created = await mux.video.assets.createPlaybackId(video.muxAssetId, {
        policy: "signed",
      });
      signedPlaybackId = created.id;
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId },
          UpdateExpression: "SET muxSignedPlaybackId = :id",
          ExpressionAttributeValues: { ":id": signedPlaybackId },
        })
      );
    } catch (err) {
      console.error("playback-token: failed to create signed playback ID:", err);
    }
  }

  if (!signedPlaybackId) {
    return NextResponse.json(
      { error: "This video isn't set up for members-only playback yet." },
      { status: 503 }
    );
  }

  const token = await signPlaybackToken(signedPlaybackId);
  if (!token) {
    return NextResponse.json(
      { error: "Members-only playback isn't configured yet." },
      { status: 503 }
    );
  }

  return NextResponse.json({ playbackId: signedPlaybackId, token });
}
