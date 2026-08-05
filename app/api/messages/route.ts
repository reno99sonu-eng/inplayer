import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { areUsersConnected } from "@/app/lib/connections";
import { createNotification } from "@/app/lib/notifications";
import { makeConversationId } from "@/app/lib/conversationId";
import { moderateText, UNCHECKED } from "@/app/lib/moderation";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { applyModerationStrike } from "@/app/lib/moderationStrikes";

const CONVERSATIONS_TABLE = "InPlayer-Conversations";
const MESSAGES_TABLE = "InPlayer-Messages";
const MAX_MESSAGE_LENGTH = 4000;
// base64 voice note cap — DynamoDB items are capped at 400KB total; this
// leaves headroom for the rest of the item, same reasoning as
// app/api/profile/avatar/route.ts's own cap.
const MAX_AUDIO_DATA_URL_LENGTH = 300_000;
// Same reasoning, for a photo attachment — the client already compresses
// to this budget via compressImageToDocument() before it ever reaches
// here (see app/messages/[conversationId]/page.tsx), this is just the
// server-side backstop.
const MAX_IMAGE_DATA_URL_LENGTH = 300_000;

// One row per (user, conversation) — the same "denormalized per-user
// index" convention this codebase already uses for Watchlist/History/
// Downloads (PK userId, SK a thing-id), rather than a single shared
// conversation row plus a GSI. Every "list my conversations" read is then
// a plain Query on the partition key, and actions that affect both sides
// (accept/block/mute/disappearing) just write both rows.
export async function GET(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: CONVERSATIONS_TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": user.userId },
      })
    );

    const rows = (result.Items || []).sort(
      (a, b) =>
        new Date(b.lastMessageAt || b.createdAt || 0).getTime() -
        new Date(a.lastMessageAt || a.createdAt || 0).getTime()
    );

    // Only conversations someone ELSE started land in Requests — my own
    // still-pending outgoing ones behave like normal conversations in my
    // own list (I already know I sent them).
    const requests = rows.filter(
      (r) => r.requestStatus === "pending" && r.initiatedBy !== user.userId
    );
    const conversations = rows.filter(
      (r) => !(r.requestStatus === "pending" && r.initiatedBy !== user.userId)
    );

    return NextResponse.json({ conversations, requests });
  } catch (err) {
    // Almost certainly means InPlayer-Conversations doesn't exist yet in
    // DynamoDB (userId as partition key, conversationId as sort key).
    console.error("Conversations unavailable:", err);
    return NextResponse.json({ conversations: [], requests: [] });
  }
}

// Starts a new conversation OR sends the next message in an existing one
// — same endpoint either way, since both need the exact same
// denormalization/notification logic and hand-duplicating it across two
// routes is exactly the kind of thing that drifts.
export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { otherUserId, text, audioUrl, audioDurationSec, imageUrl } = await request.json();

  if (!otherUserId || typeof otherUserId !== "string") {
    return NextResponse.json({ error: "Missing recipient." }, { status: 400 });
  }
  if (otherUserId === user.userId) {
    return NextResponse.json({ error: "You can't message yourself." }, { status: 400 });
  }

  const trimmedText = typeof text === "string" ? text.trim() : "";

  // Voice notes ride this same send endpoint — same denormalization/
  // notification logic either way, so duplicating it into a second route
  // is exactly the kind of thing that drifts (see the comment on POST
  // above). A message is either non-empty text OR a valid audio data URL.
  const hasValidAudio =
    typeof audioUrl === "string" &&
    audioUrl.startsWith("data:audio/") &&
    audioUrl.length > 0 &&
    audioUrl.length <= MAX_AUDIO_DATA_URL_LENGTH;

  if (typeof audioUrl === "string" && audioUrl.length > 0 && !hasValidAudio) {
    return NextResponse.json({ error: "That voice note is too long to send." }, { status: 400 });
  }

  // Photo attachment — same "either non-empty text or a valid data URL"
  // shape as voice notes, except a photo can ALSO carry a text caption
  // (trimmedText), so this doesn't participate in the empty-message OR
  // below the same way audio does.
  const hasValidImage =
    typeof imageUrl === "string" &&
    imageUrl.startsWith("data:image/") &&
    imageUrl.length > 0 &&
    imageUrl.length <= MAX_IMAGE_DATA_URL_LENGTH;

  if (typeof imageUrl === "string" && imageUrl.length > 0 && !hasValidImage) {
    return NextResponse.json({ error: "That photo is too large to send." }, { status: 400 });
  }

  if (!trimmedText && !hasValidAudio && !hasValidImage) {
    return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  }
  if (trimmedText.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: "That message is too long (4,000 characters max)." },
      { status: 400 }
    );
  }

  const validDurationSec = hasValidAudio
    ? Math.max(0, Math.min(600, Math.round(Number(audioDurationSec) || 0)))
    : undefined;

  const conversationId = makeConversationId(user.userId, otherUserId);

  try {
    const [myRow, otherUserRecord, myUserRecord, connected] = await Promise.all([
      docClient.send(
        new GetCommand({ TableName: CONVERSATIONS_TABLE, Key: { userId: user.userId, conversationId } })
      ),
      docClient.send(new GetCommand({ TableName: "InPlayer-Users", Key: { userId: otherUserId } })),
      docClient.send(new GetCommand({ TableName: "InPlayer-Users", Key: { userId: user.userId } })),
      areUsersConnected(user.userId, otherUserId),
    ]);

    if (myRow.Item?.blocked || myRow.Item?.blockedByOther) {
      return NextResponse.json({ error: "You can't message this user." }, { status: 403 });
    }

    const isNewConversation = !myRow.Item;

    // A reply from the ORIGINAL RECIPIENT of a still-pending request
    // implicitly accepts it — no separate "Accept" click required,
    // mirroring how most DM-request inboxes behave.
    const isAcceptingByReply =
      !isNewConversation &&
      myRow.Item?.requestStatus === "pending" &&
      myRow.Item?.initiatedBy !== user.userId;

    const requestStatus: "pending" | "accepted" = isNewConversation
      ? connected
        ? "accepted"
        : "pending"
      : isAcceptingByReply || myRow.Item?.requestStatus === "accepted"
        ? "accepted"
        : "pending";

    const now = new Date().toISOString();
    const messageId = `${now}#${randomUUID()}`;

    const disappearingEnabled = !isNewConversation && !!myRow.Item?.disappearingEnabled;
    const disappearingSeconds = myRow.Item?.disappearingSeconds;
    const expiresAtMs =
      disappearingEnabled && disappearingSeconds
        ? Date.now() + disappearingSeconds * 1000
        : undefined;

    // Real-time auto-moderation (app/lib/moderation.ts) — fails open, so a
    // moderation API hiccup never blocks a real message from sending.
    // Skipped entirely when Admin Panel -> Platform Settings has message
    // moderation turned off — no OpenAI call is made at all.
    const platformSettings = await getPlatformSettings();
    const moderation =
      platformSettings.moderationEnabledMessages && trimmedText
        ? await moderateText(trimmedText)
        : UNCHECKED;
    const flagged = moderation.checked && moderation.flagged;

    await docClient.send(
      new PutCommand({
        TableName: MESSAGES_TABLE,
        Item: {
          conversationId,
          messageId,
          senderId: user.userId,
          text: trimmedText,
          createdAt: now,
          ...(hasValidAudio && {
            audioUrl,
            audioDurationSec: validDurationSec,
          }),
          ...(hasValidImage && {
            imageUrl,
          }),
          ...(expiresAtMs !== undefined && {
            expiresAt: new Date(expiresAtMs).toISOString(),
            // Numeric mirror in Unix-epoch *seconds* — DynamoDB's native
            // TTL only acts on a Number attribute, never an ISO string.
            // expiresAt above is untouched for the existing read-time
            // filter/cleanup in [conversationId]/messages/route.ts; ttl
            // just lets AWS reclaim storage in the background for threads
            // that never get reopened after a message expires.
            ttl: Math.floor(expiresAtMs / 1000),
          }),
          ...(flagged && {
            flagged: true,
            flaggedCategories: moderation.categories,
            hidden: true,
            moderatedAt: now,
          }),
        },
      })
    );

    // Flagged messages are saved and queued for admin review, but never
    // shown to the recipient (see the GET on
    // [conversationId]/messages, which filters hidden ones out) — no
    // conversation-preview update or notification either, so the recipient
    // never sees so much as a hint of it until/unless an admin restores it.
    if (flagged) {
      await applyModerationStrike(request, user.userId, "message", moderation.categories).catch((err) =>
        console.error("messages: applyModerationStrike failed:", err)
      );
      return NextResponse.json({ success: true, conversationId, requestStatus, flagged: true });
    }

    const myUsername = (myUserRecord.Item?.username as string) || null;
    const myAvatarUrl = (myUserRecord.Item?.avatarUrl as string) || null;
    const otherUsername = (otherUserRecord.Item?.username as string) || null;
    const otherAvatarUrl = (otherUserRecord.Item?.avatarUrl as string) || null;
    const initiatedBy = isNewConversation ? user.userId : myRow.Item?.initiatedBy || user.userId;
    // Conversation-list preview text — a voice note has no `text` to show,
    // so both participants' row previews fall back to a label instead of
    // going blank.
    const previewText =
      trimmedText || (hasValidAudio ? "🎤 Voice message" : hasValidImage ? "📷 Photo" : "");

    await Promise.all([
      // My own row — I'm reading this conversation right now (I just sent
      // to it), so my own unread count stays 0.
      docClient.send(
        new UpdateCommand({
          TableName: CONVERSATIONS_TABLE,
          Key: { userId: user.userId, conversationId },
          UpdateExpression:
            "SET otherUserId = :otherUserId, otherUsername = :otherUsername, otherAvatarUrl = :otherAvatarUrl, " +
            "requestStatus = :requestStatus, initiatedBy = :initiatedBy, lastMessageText = :text, " +
            "lastMessageSenderId = :sender, lastMessageAt = :now, unreadCount = :zero, " +
            "createdAt = if_not_exists(createdAt, :now), blocked = if_not_exists(blocked, :false), " +
            "blockedByOther = if_not_exists(blockedByOther, :false), muted = if_not_exists(muted, :false), " +
            "disappearingEnabled = if_not_exists(disappearingEnabled, :false), " +
            "disappearingSeconds = if_not_exists(disappearingSeconds, :null)",
          ExpressionAttributeValues: {
            ":otherUserId": otherUserId,
            ":otherUsername": otherUsername,
            ":otherAvatarUrl": otherAvatarUrl,
            ":requestStatus": requestStatus,
            ":initiatedBy": initiatedBy,
            ":text": previewText,
            ":sender": user.userId,
            ":now": now,
            ":zero": 0,
            ":false": false,
            ":null": null,
          },
        })
      ),
      // Their row — increments their unread count.
      docClient.send(
        new UpdateCommand({
          TableName: CONVERSATIONS_TABLE,
          Key: { userId: otherUserId, conversationId },
          UpdateExpression:
            "SET otherUserId = :myId, otherUsername = :myUsername, otherAvatarUrl = :myAvatarUrl, " +
            "requestStatus = :requestStatus, initiatedBy = :initiatedBy, lastMessageText = :text, " +
            "lastMessageSenderId = :sender, lastMessageAt = :now, " +
            "createdAt = if_not_exists(createdAt, :now), unreadCount = if_not_exists(unreadCount, :zero) + :one, " +
            "blocked = if_not_exists(blocked, :false), blockedByOther = if_not_exists(blockedByOther, :false), " +
            "muted = if_not_exists(muted, :false), disappearingEnabled = if_not_exists(disappearingEnabled, :false), " +
            "disappearingSeconds = if_not_exists(disappearingSeconds, :null)",
          ExpressionAttributeValues: {
            ":myId": user.userId,
            ":myUsername": myUsername,
            ":myAvatarUrl": myAvatarUrl,
            ":requestStatus": requestStatus,
            ":initiatedBy": initiatedBy,
            ":text": previewText,
            ":sender": user.userId,
            ":now": now,
            ":zero": 0,
            ":one": 1,
            ":false": false,
            ":null": null,
          },
        })
      ),
    ]);

    // "request" only the moment a brand-new pending conversation is
    // created; every other send (including further ones inside an
    // already-pending thread) is a normal "message" ping — the recipient
    // already got the one-time request alert.
    const isFirstRequestPing = isNewConversation && requestStatus === "pending";
    await createNotification({
      userId: otherUserId,
      type: isFirstRequestPing ? "message_request" : "message",
      message: isFirstRequestPing
        ? `@${myUsername || "Someone"} sent you a message request`
        : `@${myUsername || "Someone"} sent you a message`,
      conversationId,
    });

    return NextResponse.json({ success: true, conversationId, requestStatus });
  } catch (err) {
    // Almost certainly means InPlayer-Conversations or InPlayer-Messages
    // doesn't exist yet in DynamoDB.
    console.error("Failed to send message:", err);
    return NextResponse.json(
      { error: "Messaging isn't available right now. Please try again shortly." },
      { status: 503 }
    );
  }
}
