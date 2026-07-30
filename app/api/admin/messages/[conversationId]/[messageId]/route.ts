import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { logAdminAction } from "@/app/lib/auditLog";

interface Params {
  params: Promise<{ conversationId: string; messageId: string }>;
}

// Restores an auto-flagged direct message (app/lib/moderation.ts via
// app/api/messages) — clears hidden/flagged so both participants can see
// it again, for when the AI got it wrong. Note: messageId contains a
// literal "#" (see app/api/messages' "<ISO timestamp>#<uuid>" format) —
// Next.js decodes the URL-encoded route param back to the real value
// automatically, so this needs no special handling here.
export async function PATCH(request: NextRequest, { params }: Params) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId, messageId } = await params;

  await docClient.send(
    new UpdateCommand({
      TableName: "InPlayer-Messages",
      Key: { conversationId, messageId },
      UpdateExpression: "SET hidden = :f, flagged = :f",
      ExpressionAttributeValues: { ":f": false },
    })
  );

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "message.restore",
    targetType: "message",
    targetId: `${conversationId}#${messageId}`,
  });

  return NextResponse.json({ success: true });
}

// Permanently removes any message.
export async function DELETE(request: NextRequest, { params }: Params) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId, messageId } = await params;

  await docClient.send(
    new DeleteCommand({ TableName: "InPlayer-Messages", Key: { conversationId, messageId } })
  );

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "message.delete",
    targetType: "message",
    targetId: `${conversationId}#${messageId}`,
  });

  return NextResponse.json({ success: true });
}
