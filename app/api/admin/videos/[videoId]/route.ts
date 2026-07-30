import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { deleteVideoCascade } from "@/app/lib/cascadeDelete";
import { logAdminAction } from "@/app/lib/auditLog";

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

  await docClient.send(
    new UpdateCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
      UpdateExpression: "SET moderationHidden = :f, flagged = :f",
      ExpressionAttributeValues: { ":f": false },
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
