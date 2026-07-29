import { NextRequest, NextResponse } from "next/server";
import { GetCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
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
    const items = (result.Items || []).filter((m) => m.hidden !== true);
    const live = items.filter((m) => !m.expiresAt || new Date(m.expiresAt).getTime() > now);
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

    return NextResponse.json({ messages: live });
  } catch (err) {
    console.error("Failed to load messages:", err);
    return NextResponse.json({ messages: [] });
  }
}
