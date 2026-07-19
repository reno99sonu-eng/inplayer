import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

export async function GET(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: "InPlayer-Notifications",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": user.userId },
    })
  );

  const notifications = (result.Items || []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json({ notifications });
}

// Marks every one of the current user's notifications as read — called
// when they open the notification panel.
export async function PATCH(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: "InPlayer-Notifications",
      KeyConditionExpression: "userId = :userId",
      FilterExpression: "#read = :falseValue",
      ExpressionAttributeNames: { "#read": "read" },
      ExpressionAttributeValues: {
        ":userId": user.userId,
        ":falseValue": false,
      },
    })
  );

  const unread = result.Items || [];

  await Promise.all(
    unread.map((item) =>
      docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Notifications",
          Key: { userId: user.userId, notificationId: item.notificationId },
          UpdateExpression: "SET #read = :true",
          ExpressionAttributeNames: { "#read": "read" },
          ExpressionAttributeValues: { ":true": true },
        })
      )
    )
  );

  return NextResponse.json({ success: true });
}