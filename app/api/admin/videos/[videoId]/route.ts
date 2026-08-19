import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { deleteVideoCascade } from "@/app/lib/cascadeDelete";
import { logAdminAction } from "@/app/lib/auditLog";
import { audienceFlags, normalizeVideoAudience } from "@/app/lib/contentAccess";

// Restores a video/Short auto-flagged at upload (app/lib/moderation.ts via
// app/api/upload/create) — clears moderationHidden so it reappears in
// public listings and at its direct watch link (see app/lib/videoStore.ts
// and app/watch/[videoId]/page.tsx), for when the AI got it wrong.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId } = await params;

  // An audience mismatch (app/lib/audienceClassifier.ts) also lands in the
  // moderation queue, and restoring one means "the AI read the audience
  // wrong" — so it has to do two things beyond simply un-hiding:
  //
  //   1. Clear audienceMismatch, or the item sits in the queue forever no
  //      matter how many times an admin reviews it.
  //   2. Put the audience back to what the CREATOR declared. The classifier
  //      may have overridden it (a strong verdict forces 18+, and any adult
  //      signal pulls an upload out of Kids). Leaving that override in place
  //      while reporting the video as "restored" would be a lie — it would
  //      still be invisible to everyone in the default mode.
  //
  // A video with no audienceDeclared recorded (published before this
  // existed) simply keeps whatever audience it already has.
  const existing = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
      ProjectionExpression: "audienceDeclared",
    })
  );
  const declared = normalizeVideoAudience(existing.Item?.audienceDeclared);
  const declaredFlags = declared ? audienceFlags(declared) : null;

  await docClient.send(
    new UpdateCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
      UpdateExpression: declaredFlags
        ? "SET moderationHidden = :f, flagged = :f, audienceMismatch = :f, " +
          "#audience = :audience, madeForKids = :madeForKids, ageRestricted = :ageRestricted"
        : "SET moderationHidden = :f, flagged = :f, audienceMismatch = :f",
      ExpressionAttributeValues: {
        ":f": false,
        ...(declared &&
          declaredFlags && {
            ":audience": declared,
            ":madeForKids": declaredFlags.madeForKids,
            ":ageRestricted": declaredFlags.ageRestricted,
          }),
      },
      // `audience` aliased rather than written bare, for the same
      // reserved-word reason documented in app/api/my-videos/[videoId].
      ...(declaredFlags && { ExpressionAttributeNames: { "#audience": "audience" } }),
    })
  );

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "video.restore",
    targetType: "video",
    targetId: videoId,
  });

  return NextResponse.json({ success: true });
}

// Admin removal of any video or Short, regardless of who uploaded it —
// app/api/my-videos/[videoId]'s DELETE is the creator-owned equivalent
// (ownership-gated); this calls the exact same shared cascade
// (app/lib/cascadeDelete.ts), just gated by requireAdmin instead of
// upload ownership, for moderation use. Real, full, permanent deletion:
// the Mux asset AND every row anywhere in the app that references this
// video (comments, likes, watch history, playlist entries, notifications,
// reports, daily view stats), not just the video row itself.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId } = await params;
  if (!videoId) {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }

  const result = await deleteVideoCascade(videoId);
  if (!result.success && result.errors[0] === "Video not found.") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!result.success) {
    console.error(`Admin delete: video ${videoId} had partial failures:`, result.errors);
  }

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "video.delete",
    targetType: "video",
    targetId: videoId,
    details:
      result.errors.length > 0
        ? `Completed with ${result.errors.length} warning(s) — see server logs.`
        : undefined,
  });

  return NextResponse.json({ success: true, warnings: result.errors });
}
