import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { createNotification } from "@/app/lib/notifications";

const CONVERSATIONS_TABLE = "InPlayer-Conversations";
const MESSAGES_TABLE = "InPlayer-Messages";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid group request." }, { status: 400 });
  }

  const { groupName, memberUserIds } = body;
  const trimmedName = typeof groupName === "string" ? groupName.trim() : "";
  if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 60) {
    return NextResponse.json({ error: "Group name must be between 2 and 60 characters." }, { status: 400 });
  }

  if (!Array.isArray(memberUserIds) || memberUserIds.length === 0) {
    return NextResponse.json({ error: "Please select at least one member to add." }, { status: 400 });
  }

  // Deduplicate and filter out self
  const uniqueMemberIds = Array.from(new Set(memberUserIds.filter((id) => typeof id === "string" && id !== user.userId)));
  if (uniqueMemberIds.length === 0) {
    return NextResponse.json({ error: "Please select other members to add." }, { status: 400 });
  }

  const allMembers = [user.userId, ...uniqueMemberIds];
  const conversationId = `group_${randomUUID()}`;
  const now = new Date().toISOString();

  // Fetch creator profile
  let creatorName = user.email || "Someone";
  try {
    const creatorRecord = await docClient.send(
      new GetCommand({ TableName: "InPlayer-Users", Key: { userId: user.userId } })
    );
    if (creatorRecord.Item?.username) creatorName = `@${creatorRecord.Item.username}`;
    else if (creatorRecord.Item?.name) creatorName = creatorRecord.Item.name;
  } catch {}

  try {
    // 1. Create creator row (accepted)
    await docClient.send(
      new PutCommand({
        TableName: CONVERSATIONS_TABLE,
        Item: {
          userId: user.userId,
          conversationId,
          isGroup: true,
          groupName: trimmedName,
          creatorId: user.userId,
          adminUserId: user.userId,
          memberUserIds: allMembers,
          requestStatus: "accepted",
          unreadCount: 0,
          lastMessage: `Group created by ${creatorName}`,
          lastMessageAt: now,
          createdAt: now,
        },
      })
    );

    // 2. Create pending rows for added members
    await Promise.all(
      uniqueMemberIds.map((memberId) =>
        docClient.send(
          new PutCommand({
            TableName: CONVERSATIONS_TABLE,
            Item: {
              userId: memberId,
              conversationId,
              isGroup: true,
              groupName: trimmedName,
              creatorId: user.userId,
              adminUserId: user.userId,
              initiatedBy: user.userId,
              memberUserIds: allMembers,
              requestStatus: "pending",
              unreadCount: 1,
              lastMessage: `Group invitation from ${creatorName}`,
              lastMessageAt: now,
              createdAt: now,
            },
          })
        )
      )
    );

    // 3. Send initial system message
    await docClient.send(
      new PutCommand({
        TableName: MESSAGES_TABLE,
        Item: {
          conversationId,
          messageId: `${now}#${randomUUID()}`,
          senderId: user.userId,
          senderUsername: creatorName,
          text: `${creatorName} created group "${trimmedName}"`,
          isSystem: true,
          createdAt: now,
        },
      })
    );

    // 4. Send notifications to added members
    await Promise.all(
      uniqueMemberIds.map((memberId) =>
        createNotification({
          userId: memberId,
          type: "message",
          message: `${creatorName} invited you to join the group "${trimmedName}".`,
        }).catch(() => null)
      )
    );

    return NextResponse.json({
      success: true,
      conversationId,
      groupName: trimmedName,
      memberCount: allMembers.length,
    });
  } catch (err) {
    console.error("Failed to create group:", err);
    return NextResponse.json({ error: "Could not create group. Please try again." }, { status: 500 });
  }
}
