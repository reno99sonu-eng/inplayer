import { NextRequest, NextResponse } from "next/server";
import {
  QueryCommand,
  PutCommand,
  DeleteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
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
  } catch {
    // Not signed in — fine, just report as not subscribed
  }

  return NextResponse.json({
    subscriberCount: countResult.Count || 0,
    isSubscribed,
  });
}

export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { creatorId, action } = await request.json();

  if (!creatorId || !["subscribe", "unsubscribe"].includes(action)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (creatorId === user.userId) {
    return NextResponse.json(
      { error: "You can't subscribe to yourself." },
      { status: 400 }
    );
  }

  if (action === "subscribe") {
    await docClient.send(
      new PutCommand({
        TableName: "InPlayer-Subscriptions",
        Item: {
          subscriberId: user.userId,
          creatorId,
          subscribedAt: new Date().toISOString(),
        },
      })
    );
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