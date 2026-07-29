import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";

// Marks a human-submitted report (InPlayer-Reports) as handled. This never
// touches the reported content itself — an admin who wants the
// comment/message/video actually removed does that separately (see
// app/api/admin/comments, app/api/admin/messages, app/api/admin/videos),
// since "resolved" can just as validly mean "reviewed, no action needed."
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reportId } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status === "open" ? "open" : "resolved";

  await docClient.send(
    new UpdateCommand({
      TableName: "InPlayer-Reports",
      Key: { reportId },
      UpdateExpression: "SET #s = :s, reviewedAt = :r",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": status, ":r": new Date().toISOString() },
    })
  );

  return NextResponse.json({ success: true });
}
