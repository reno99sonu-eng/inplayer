import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

// Real online/offline presence — deliberately NOT a websocket connection
// (no such infrastructure exists here). Instead, AuthProvider pings this
// route every ~45s for as long as the app is open in a signed-in tab, and
// anyone reading InPlayer-Users.lastActiveAt treats "updated within the
// last ~90s" as "online" (see PRESENCE_WINDOW_MS in
// app/messages/[conversationId]/route.ts) — a small buffer so a normal
// gap between two heartbeats never flickers someone to "offline" and back.
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Users",
        Key: { userId: user.userId },
        UpdateExpression: "SET lastActiveAt = :now",
        ExpressionAttributeValues: { ":now": new Date().toISOString() },
      })
    );
  } catch (err) {
    // Presence is best-effort — never worth surfacing an error to the
    // user over a heartbeat write failing once.
    console.error("Failed to record presence heartbeat:", err);
  }

  return NextResponse.json({ success: true });
}
