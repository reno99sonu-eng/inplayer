import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

export async function GET(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json(
      { error: "Please sign in." },
      { status: 401 }
    );
  }

  try {
    const subscriptions = await docClient.send(
      new QueryCommand({
        TableName: "InPlayer-Subscriptions",
        KeyConditionExpression: "subscriberId = :subscriberId",
        ExpressionAttributeValues: {
          ":subscriberId": user.userId,
        },
      })
    );

    const items = subscriptions.Items ?? [];

    const creators = await Promise.all(
      items.map(async (subscription) => {
        const creatorId = subscription.creatorId as string;

        const profile = await docClient.send(
          new GetCommand({
            TableName: "InPlayer-Users",
            Key: {
              userId: creatorId,
            },
          })
        );

        if (!profile.Item) {
          return null;
        }

        return {
          creatorId,
          username: profile.Item.username ?? "",
          name:
            profile.Item.name ??
            profile.Item.displayName ??
            profile.Item.username ??
            "Unknown Creator",
          avatarUrl: profile.Item.avatarUrl ?? null,
          notifyEnabled: subscription.notifyEnabled !== false,
        };
      })
    );

    return NextResponse.json({
      subscriptions: creators.filter(Boolean),
    });
  } catch (err) {
    console.error("Failed to load subscriptions:", err);

    return NextResponse.json(
      {
        error: "Failed to load subscriptions.",
      },
      {
        status: 500,
      }
    );
  }
}