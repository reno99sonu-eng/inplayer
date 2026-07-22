import { NextRequest, NextResponse } from "next/server";
import {
  QueryCommand,
  PutCommand,
  DeleteCommand,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

export async function GET(request: NextRequest) {
  const creatorId = request.nextUrl.searchParams.get("creatorId");

  if (!creatorId) {
    return NextResponse.json({ error: "creatorId is required" }, { status: 400 });
  }

  const countResult = await docClient.send(
    new QueryCommand({
      TableName: "InPlayer-Subscriptions",
      IndexName: "creatorId-index",
      KeyConditionExpression: "creatorId = :creatorId",
      ExpressionAttributeValues: { ":creatorId": creatorId },
      Select: "COUNT",
    })
  );

  let isSubscribed = false;
  // Whether this subscriber wants notifications from the creator (the bell
  // toggle on the In-Family button). Defaults to true when subscribed, since
  // subscribing opts you into notifications unless you turn the bell off.
  let notifyEnabled = true;

  // Checking subscription status requires knowing who's asking — but
  // viewing the count doesn't. So we try to verify auth, and simply
  // treat a missing/invalid token as "not signed in" rather than an error.
  try {
    const user = await verifyAuth(request);
    const existing = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Subscriptions",
        Key: { subscriberId: user.userId, creatorId },
      })
    );
    isSubscribed = !!existing.Item;
    // Treat a missing flag on an existing subscription as "on" (older
    // subscriptions predate the bell toggle).
    notifyEnabled = existing.Item?.notifyEnabled !== false;
  } catch {
    // Not signed in — fine, just report as not subscribed
  }

  return NextResponse.json({
    subscriberCount: countResult.Count || 0,
    isSubscribed,
    notifyEnabled,
  });
}

export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { creatorId, action, notifyEnabled } = await request.json();

  if (
    !creatorId ||
    !["subscribe", "unsubscribe", "notify"].includes(action)
  ) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (creatorId === user.userId) {
    return NextResponse.json(
      { error: "You can't subscribe to yourself." },
      { status: 400 }
    );
  }

  // Bell toggle — only updates the notification preference on an existing
  // subscription, never creates or removes the subscription itself.
  if (action === "notify") {
    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Subscriptions",
        Key: { subscriberId: user.userId, creatorId },
        UpdateExpression: "SET notifyEnabled = :n",
        // Only apply if the subscription actually exists, so a stray toggle
        // can't create a half-formed record.
        ConditionExpression: "attribute_exists(subscriberId)",
        ExpressionAttributeValues: { ":n": notifyEnabled !== false },
      })
    ).catch((err) => {
      // ConditionalCheckFailed just means "not subscribed" — not a real
      // error worth 500-ing over.
      console.error("Failed to update notify preference:", err?.name || err);
    });

    return NextResponse.json({ success: true });
  }

  if (action === "subscribe") {
    await docClient.send(
      new PutCommand({
        TableName: "InPlayer-Subscriptions",
        Item: {
          subscriberId: user.userId,
          creatorId,
          subscribedAt: new Date().toISOString(),
          notifyEnabled: true,
        },
      })
    );

    try {
      await docClient.send(
        new PutCommand({
          TableName: "InPlayer-Notifications",
          Item: {
            userId: creatorId,
            notificationId: randomUUID(),
            type: "subscribe",
            message: `${user.name || "Someone"} subscribed to your channel`,
            read: false,
            createdAt: new Date().toISOString(),
          },
        })
      );
    } catch (err) {
      console.error("Failed to write subscribe notification:", err);
    }
  } else {
    await docClient.send(
      new DeleteCommand({
        TableName: "InPlayer-Subscriptions",
        Key: { subscriberId: user.userId, creatorId },
      })
    );
  }

  return NextResponse.json({ success: true });
}