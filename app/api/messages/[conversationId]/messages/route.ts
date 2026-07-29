import { NextRequest, NextResponse } from "next/server";
import { GetCommand, QueryCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

interface Params {
  params: Promise<{ conversationId: string }>;
}

// Sending lives on POST /api/messages (see that route) — it needs the
// exact same denormalization/notification logic whether it's the first
// message in a brand new thread or the fiftieth in an existing one, so
// keeping a single write path avoids the two drifting apart. This route
// is read-only: the thread's message history.
export async function GET(request: NextRequest, { params }: Params) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { conversationId } = await params;

  // Ownership check — only a participant can read the thread.
  let myRow;
  try {
    myRow = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Conversations",
        Key: { userId: user.userId, conversationId },
      })
    );
  } catch (err) {
    console.error("Failed to verify conversation ownership:", err);
    return NextResponse.json({ messages: [] });
  }

  if (!myRow.Item) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: "InPlayer-Messages",
        KeyConditionExpression: "conversationId = :c",
        ExpressionAttributeValues: { ":c": conversationId },
        // messageId is "<ISO timestamp>#<uuid>", so ascending sort-key
        // order is already exact chronological order — oldest first,
        // ready to render top-to-bottom as-is.
      })
    );

    const now = Date.now();
    // Auto-flagged messages (see moderateText in app/api/messages' POST)
    // are held out of the thread entirely — including from the sender —
    // until an admin reviews them in the Admin Panel's moderation queue.
    // "Delete for me" (hiddenFor) is per-caller — only excluded for
    // whichever participant deleted it, the other side still sees it
    // normally.
    const items = (result.Items || []).filter(
      (m) => m.hidden !== true && !(Array.isArray(m.hiddenFor) && m.hiddenFor.includes(user.userId))
    );
    const live = items
      .filter((m) => !m.expiresAt || new Date(m.expiresAt).getTime() > now)
      // "Delete for everyone" keeps the row (and its real text) in the
      // database for moderation/legal retention — see the PATCH handler
      // below — but every reader gets a placeholder instead of the real
      // content from this point on.
      .map((m) =>
        m.deletedForEveryone ? { ...m, text: "This message was deleted." } : m
      );
    const expired = items.filter((m) => m.expiresAt && new Date(m.expiresAt).getTime() <= now);

    // Best-effort cleanup of anything that's aged out. Not awaited — this
    // is disappearing messages "actually disappearing on read" at the
    // app level; a real TTL attribute configured on the table in AWS
    // would additionally reclaim storage automatically, but isn't
    // something this code can turn on by itself.
    if (expired.length > 0) {
      Promise.all(
        expired.map((m) =>
          docClient.send(
            new DeleteCommand({
              TableName: "InPlayer-Messages",
              Key: { conversationId, messageId: m.messageId },
            })
          )
        )
      ).catch((err) => console.error("Failed to clean up expired messages:", err));
    }

    const otherUserId = myRow.Item.otherUserId as string | undefined;

    // Read receipts, no separate "mark as read" click required — every
    // poll of the open thread (this route, called every few seconds by
    // the client) IS the caller actively reading it, so this is where
    // "read" actually gets recorded. Not awaited: it must never delay the
    // messages the caller is waiting on, and a missed write just means
    // the next poll (a few seconds later) catches it instead.
    docClient
      .send(
        new UpdateCommand({
          TableName: "InPlayer-Conversations",
          Key: { userId: user.userId, conversationId },
          UpdateExpression: "SET lastReadAt = :now, unreadCount = :zero",
          ExpressionAttributeValues: { ":now": new Date(now).toISOString(), ":zero": 0 },
        })
      )
      .catch((err) => console.error("Failed to record read receipt:", err));

    // The other participant's read receipt — read from THEIR own
    // conversation row so the sender can render "Read" ticks on messages
    // they sent. Best-effort: a lookup failure just means ticks briefly
    // show "Delivered" instead of "Read," never breaks loading the thread.
    let otherLastReadAt: string | null = null;
    let otherIsTyping = false;
    if (otherUserId) {
      try {
        const otherRow = await docClient.send(
          new GetCommand({
            TableName: "InPlayer-Conversations",
            Key: { userId: otherUserId, conversationId },
            ProjectionExpression: "lastReadAt",
          })
        );
        otherLastReadAt = (otherRow.Item?.lastReadAt as string) || null;
      } catch (err) {
        console.error("Failed to load the other participant's read receipt:", err);
      }

      // Typing indicator — see app/api/messages/[conversationId]/typing.
      // The OTHER participant pings THAT route while they type, which
      // writes typingFrom/typingUntil onto MY OWN row (the row being read
      // right here), so no extra polling loop is needed for this.
      const typingFrom = myRow.Item.typingFrom as string | undefined;
      const typingUntil = myRow.Item.typingUntil as number | undefined;
      otherIsTyping = typingFrom === otherUserId && !!typingUntil && typingUntil > now;
    }

    return NextResponse.json({ messages: live, otherLastReadAt, otherIsTyping });
  } catch (err) {
    console.error("Failed to load messages:", err);
    return NextResponse.json({ messages: [] });
  }
}

// Deleting a message, WhatsApp-style — two modes:
//   "delete_for_me": hides it from the caller's own view only (adds them
//     to hiddenFor). The other participant is unaffected.
//   "delete_for_everyone": only the original sender can do this. The row
//     and its real text are DELIBERATELY kept in the database rather than
//     hard-deleted — every reader is shown a placeholder instead (see the
//     GET handler above), but the real content stays available for
//     moderation/legal retention if it's ever needed, the same real-world
//     tradeoff other messaging platforms make for exactly this reason.
export async function PATCH(request: NextRequest, { params }: Params) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { conversationId } = await params;
  const body = await request.json().catch(() => null);
  const messageId = body?.messageId;
  const action = body?.action;

  if (!messageId || (action !== "delete_for_me" && action !== "delete_for_everyone")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const existing = await docClient.send(
    new GetCommand({ TableName: "InPlayer-Messages", Key: { conversationId, messageId } })
  );
  if (!existing.Item) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  if (action === "delete_for_everyone") {
    if (existing.Item.senderId !== user.userId) {
      return NextResponse.json(
        { error: "You can only delete for everyone on messages you sent." },
        { status: 403 }
      );
    }
    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Messages",
        Key: { conversationId, messageId },
        UpdateExpression: "SET deletedForEveryone = :t, deletedAt = :now",
        ExpressionAttributeValues: { ":t": true, ":now": new Date().toISOString() },
      })
    );
    return NextResponse.json({ success: true });
  }

  // delete_for_me
  await docClient.send(
    new UpdateCommand({
      TableName: "InPlayer-Messages",
      Key: { conversationId, messageId },
      UpdateExpression:
        "SET hiddenFor = list_append(if_not_exists(hiddenFor, :empty), :me)",
      ExpressionAttributeValues: { ":empty": [], ":me": [user.userId] },
    })
  );
  return NextResponse.json({ success: true });
}
