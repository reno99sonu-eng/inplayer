import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { logAdminAction } from "@/app/lib/auditLog";

interface Params {
  params: Promise<{ videoId: string; commentId: string }>;
}

// Restores an auto-flagged comment (app/lib/moderation.ts via
// app/api/comments) — clears hidden/flagged so it shows up normally again,
// for when the AI got it wrong.
export async function PATCH(request: NextRequest, { params }: Params) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId, commentId } = await params;

  await docClient.send(
    new UpdateCommand({
      TableName: "InPlayer-Comments",
      Key: { videoId, commentId },
      UpdateExpression: "SET hidden = :f, flagged = :f",
      ExpressionAttributeValues: { ":f": false },
    })
  );

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "comment.restore",
    targetType: "comment",
    targetId: `${videoId}#${commentId}`,
  });

  return NextResponse.json({ success: true });
}

// Permanently removes any comment, regardless of who posted it — the
// admin-moderation equivalent of the owner-only DELETE on app/api/comments.
export async function DELETE(request: NextRequest, { params }: Params) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId, commentId } = await params;

  await docClient.send(
    new DeleteCommand({ TableName: "InPlayer-Comments", Key: { videoId, commentId } })
  );

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "comment.delete",
    targetType: "comment",
    targetId: `${videoId}#${commentId}`,
  });

  return NextResponse.json({ success: true });
}
