import { NextRequest, NextResponse } from "next/server";
import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requirePermission } from "@/app/lib/isAdmin";
import { deleteVideoCascade } from "@/app/lib/cascadeDelete";
import { logAdminAction } from "@/app/lib/auditLog";

// The ONE content-deletion pathway a team member (permission
// "delete_stuck_processing_videos") may ever reach — every other video/
// music/Short deletion route stays gated to requireAdmin (main admin
// only). Deliberately narrow: both GET and DELETE re-derive eligibility
// server-side from the stored row, never from anything the client claims,
// so this can't be turned into "delete any video" by a crafted request.
const STUCK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

function isStuck(item: Record<string, unknown>): boolean {
  if (item.status !== "processing") return false;
  const uploadedAt = typeof item.uploadedAt === "string" ? Date.parse(item.uploadedAt) : NaN;
  if (!Number.isFinite(uploadedAt)) return false;
  return Date.now() - uploadedAt > STUCK_THRESHOLD_MS;
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "delete_stuck_processing_videos");
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        FilterExpression: "#status = :processing",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":processing": "processing" },
        ProjectionExpression:
          "videoId, title, uploaderName, uploaderId, contentType, uploadedAt, #status",
      })
    );

    const stuck = (result.Items || [])
      .filter(isStuck)
      .map((v) => ({
        videoId: v.videoId,
        title: v.title || "Untitled",
        uploaderName: v.uploaderName || "Unknown",
        contentType: v.contentType || "video",
        uploadedAt: v.uploadedAt,
        stuckHours: Math.floor((Date.now() - Date.parse(v.uploadedAt as string)) / (60 * 60 * 1000)),
      }));

    return NextResponse.json({ videos: stuck });
  } catch (err) {
    console.error("Failed to list stuck-processing videos:", err);
    return NextResponse.json({ videos: [] }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  let admin;
  try {
    admin = await requirePermission(request, "delete_stuck_processing_videos");
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const videoId = request.nextUrl.searchParams.get("videoId");
  if (!videoId) {
    return NextResponse.json({ error: "Missing videoId." }, { status: 400 });
  }

  const existing = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
      ProjectionExpression: "videoId, #status, uploadedAt",
      ExpressionAttributeNames: { "#status": "status" },
    })
  );

  if (!existing.Item) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!isStuck(existing.Item)) {
    return NextResponse.json(
      { error: "This video isn't stuck in processing — it can't be deleted from here." },
      { status: 403 }
    );
  }

  const result = await deleteVideoCascade(videoId);

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "video.delete_stuck_processing",
    targetType: "video",
    targetId: videoId,
    details: admin.isMainAdmin ? undefined : "Deleted via team-member stuck-processing cleanup.",
  });

  return NextResponse.json({ success: true, warnings: result.errors });
}
