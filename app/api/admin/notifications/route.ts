import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { createNotification } from "@/app/lib/notifications";
import { logAdminAction } from "@/app/lib/auditLog";
import { normalizeUsername } from "@/app/lib/username";

const MAX_MESSAGE_LENGTH = 500;

// Real broadcast notifications — each one is a genuine row written to
// InPlayer-Notifications per recipient via createNotification() (the same
// writer used by likes/comments/subscriptions), so it shows up in that
// user's real notification bell, not a preview or a queued draft.
//
// Sending to "all" does one Scan of InPlayer-Users to collect every
// userId, then fires a real write per recipient in parallel. At InPlayer's
// current scale that's fine inside one request; if the user base grows
// into the tens of thousands this would need to move to a background job
// instead of running synchronously inside a serverless function's timeout
// window — flagged here rather than silently breaking later.
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const target = body?.target === "user" ? "user" : body?.target === "all" ? "all" : null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!target) {
    return NextResponse.json({ error: "Invalid target." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }

  if (target === "user") {
    const rawUsername = typeof body?.username === "string" ? body.username : "";
    const usernameLower = normalizeUsername(rawUsername);
    if (!usernameLower) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }

    const handle = await docClient.send(
      new GetCommand({ TableName: "InPlayer-Usernames", Key: { usernameLower } })
    );
    const userId = handle.Item?.userId as string | undefined;
    if (!userId) {
      return NextResponse.json(
        { error: `No user found with the username "${rawUsername.trim()}".` },
        { status: 404 }
      );
    }

    await createNotification({ userId, type: "admin_announcement", message });

    await logAdminAction({
      request,
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "notification.broadcast",
      targetType: "notification",
      targetId: `@${usernameLower}`,
      details: message,
    });

    return NextResponse.json({ success: true, sentCount: 1 });
  }

  // target === "all"
  const userIds: string[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Users",
        ProjectionExpression: "userId",
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    for (const item of result.Items || []) {
      if (item.userId) userIds.push(item.userId as string);
    }
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  await Promise.all(
    userIds.map((userId) => createNotification({ userId, type: "admin_announcement", message }))
  );

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "notification.broadcast",
    targetType: "notification",
    targetId: `all (${userIds.length} user${userIds.length === 1 ? "" : "s"})`,
    details: message,
  });

  return NextResponse.json({ success: true, sentCount: userIds.length });
}
