import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

const CONVERSATIONS_TABLE = "InPlayer-Conversations";
const DISAPPEARING_OPTIONS = [3600, 86400, 604800]; // 1 hour / 1 day / 1 week

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

    return NextResponse.json({ conversation: { ...row, unreadCount: 0 } });
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
  const { action, seconds } = await request.json();

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
