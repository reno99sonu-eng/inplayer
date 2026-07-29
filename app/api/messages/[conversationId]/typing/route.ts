import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

const CONVERSATIONS_TABLE = "InPlayer-Conversations";

// How long a single "I'm typing" ping stays visible to the other side if
// no follow-up ping arrives — the client re-pings every ~2s while the
// input has text, so this only actually expires the indicator once
// someone genuinely stops typing (or closes the tab).
const TYPING_TTL_MS = 6000;

interface Params {
  params: Promise<{ conversationId: string }>;
}

// Called on a debounce from the message input (see
// app/messages/[conversationId]/page.tsx) while the caller has text in
// the box. Writes the "someone is typing to me" flag onto the OTHER
// participant's own conversation row — that's the row that participant's
// client reads back (piggybacked on the existing message-polling GET at
// ../messages/route.ts) to show the three-dot indicator, no separate
// polling loop needed.
export async function POST(request: NextRequest, { params }: Params) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { conversationId } = await params;

  try {
    const myRow = await docClient.send(
      new GetCommand({
        TableName: CONVERSATIONS_TABLE,
        Key: { userId: user.userId, conversationId },
      })
    );
    const otherUserId = myRow.Item?.otherUserId;
    if (!otherUserId) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    await docClient.send(
      new UpdateCommand({
        TableName: CONVERSATIONS_TABLE,
        Key: { userId: otherUserId, conversationId },
        UpdateExpression: "SET typingFrom = :me, typingUntil = :until",
        ExpressionAttributeValues: {
          ":me": user.userId,
          ":until": Date.now() + TYPING_TTL_MS,
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    // Typing indicators are a nice-to-have, not something worth surfacing
    // an error banner over.
    console.error("Failed to record typing ping:", err);
    return NextResponse.json({ success: true });
  }
}
