import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { CHAT_THEMES } from "@/app/components/chat/ChatThemes";

const CONVERSATIONS_TABLE = "InPlayer-Conversations";
const DISAPPEARING_OPTIONS = [3600, 86400, 604800]; // 1 hour / 1 day / 1 week

// Anyone whose presence heartbeat (app/api/presence) landed within this
// window counts as "online" — wider than the 45s heartbeat interval in
// AuthProvider so one slightly-late ping never flickers someone offline
// and back.
const PRESENCE_WINDOW_MS = 90_000;

interface Params {
  params: Promise<{ conversationId: string }>;
}

async function getMyRow(conversationId: string, userId: string) {
  const result = await docClient.send(
    new GetCommand({ TableName: CONVERSATIONS_TABLE, Key: { userId, conversationId } })
  );
  return result.Item || null;
}

// Fetches this conversation as I see it, and marks it read as a side
// effect — opening a thread implies reading it, same idea as the
// notification bell marking everything read the moment its panel opens.
export async function GET(request: NextRequest, { params }: Params) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { conversationId } = await params;

  try {
    const row = await getMyRow(conversationId, user.userId);
    if (!row) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    if (row.unreadCount > 0) {
      await docClient
        .send(
          new UpdateCommand({
            TableName: CONVERSATIONS_TABLE,
            Key: { userId: user.userId, conversationId },
            UpdateExpression: "SET unreadCount = :zero",
            ExpressionAttributeValues: { ":zero": 0 },
          })
        )
        .catch((err) => console.error("Failed to clear unread count:", err));
    }

    // Real online/offline presence for the header ("Online" / "Last seen
    // ..."), read from the other participant's own InPlayer-Users row —
    // best-effort, never lets a presence lookup failure break loading the
    // conversation itself.
    let otherLastActiveAt: string | null = null;
    if (row.otherUserId) {
      try {
        const otherUserRow = await docClient.send(
          new GetCommand({
            TableName: "InPlayer-Users",
            Key: { userId: row.otherUserId },
            ProjectionExpression: "lastActiveAt",
          })
        );
        otherLastActiveAt = (otherUserRow.Item?.lastActiveAt as string) || null;
      } catch (err) {
        console.error("Failed to load presence:", err);
      }
    }
    const otherIsOnline = !!(
      otherLastActiveAt && Date.now() - new Date(otherLastActiveAt).getTime() < PRESENCE_WINDOW_MS
    );

    return NextResponse.json({
      conversation: { ...row, unreadCount: 0 },
      otherIsOnline,
      otherLastActiveAt,
    });
  } catch (err) {
    console.error("Failed to load conversation:", err);
    return NextResponse.json({ error: "Couldn't load that conversation." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { conversationId } = await params;
  const { action, seconds, theme } = await request.json();

  let row;
  try {
    row = await getMyRow(conversationId, user.userId);
  } catch (err) {
    console.error("Failed to load conversation for action:", err);
    return NextResponse.json({ error: "Couldn't complete that action. Please try again." }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  const otherUserId = row.otherUserId;

  try {
    switch (action) {
      case "accept": {
        await Promise.all(
          [user.userId, otherUserId].map((uid) =>
            docClient.send(
              new UpdateCommand({
                TableName: CONVERSATIONS_TABLE,
                Key: { userId: uid, conversationId },
                UpdateExpression: "SET requestStatus = :s",
                ExpressionAttributeValues: { ":s": "accepted" },
              })
            )
          )
        );
        break;
      }

      case "decline": {
        // Removes it from MY view only — the sender's own copy (and the
        // thread itself) is untouched, same as most DM-request inboxes
        // ("delete on my side," not a mutual unsend).
        await docClient.send(
          new DeleteCommand({
            TableName: CONVERSATIONS_TABLE,
            Key: { userId: user.userId, conversationId },
          })
        );
        break;
      }

      case "block":
      case "unblock": {
        const blockedValue = action === "block";
        await Promise.all([
          docClient.send(
            new UpdateCommand({
              TableName: CONVERSATIONS_TABLE,
              Key: { userId: user.userId, conversationId },
              UpdateExpression: "SET blocked = :v",
              ExpressionAttributeValues: { ":v": blockedValue },
            })
          ),
          docClient.send(
            new UpdateCommand({
              TableName: CONVERSATIONS_TABLE,
              Key: { userId: otherUserId, conversationId },
              UpdateExpression: "SET blockedByOther = :v",
              ExpressionAttributeValues: { ":v": blockedValue },
            })
          ),
        ]);
        break;
      }

      case "mute":
      case "unmute": {
        await docClient.send(
          new UpdateCommand({
            TableName: CONVERSATIONS_TABLE,
            Key: { userId: user.userId, conversationId },
            UpdateExpression: "SET muted = :v",
            ExpressionAttributeValues: { ":v": action === "mute" },
          })
        );
        break;
      }

      case "set_theme": {
        // Personal preference, like mute — written to MY OWN row only, not
        // the other participant's, so each side can pick their own chat
        // wallpaper independently.
        const themeId = typeof theme === "string" && theme in CHAT_THEMES ? theme : "default";
        await docClient.send(
          new UpdateCommand({
            TableName: CONVERSATIONS_TABLE,
            Key: { userId: user.userId, conversationId },
            UpdateExpression: "SET chatTheme = :v",
            ExpressionAttributeValues: { ":v": themeId },
          })
        );
        break;
      }

      case "toggle_disappearing": {
        const enabled = !row.disappearingEnabled;
        const validSeconds = DISAPPEARING_OPTIONS.includes(seconds) ? seconds : 86400;
        await Promise.all(
          [user.userId, otherUserId].map((uid) =>
            docClient.send(
              new UpdateCommand({
                TableName: CONVERSATIONS_TABLE,
                Key: { userId: uid, conversationId },
                UpdateExpression: "SET disappearingEnabled = :e, disappearingSeconds = :s",
                ExpressionAttributeValues: {
                  ":e": enabled,
                  ":s": enabled ? validSeconds : null,
                },
              })
            )
          )
        );
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`Failed to apply conversation action "${action}":`, err);
    return NextResponse.json(
      { error: "Couldn't complete that action. Please try again." },
      { status: 500 }
    );
  }
}
