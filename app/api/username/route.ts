import { NextRequest, NextResponse } from "next/server";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import {
  normalizeUsername,
  isValidUsernameFormat,
  isReservedUsername,
} from "@/app/lib/username";

// Claims (or changes) the caller's username. Uniqueness is enforced by
// InPlayer-Usernames — a lookup table keyed by the lowercased handle,
// which has no other purpose than being a uniqueness lock (DynamoDB has
// no native "unique attribute" constraint, so a dedicated keyed item is
// the standard way to get one). The claim + release-of-any-old-handle +
// update-to-the-profile-item all happen in a single transaction, so two
// people racing for the same username can never both win, and a change
// can never leave a dangling old reservation.
export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { username } = await request.json();

  if (typeof username !== "string" || !isValidUsernameFormat(username)) {
    return NextResponse.json(
      {
        error:
          "3-20 characters, starting with a letter — letters, numbers, and underscores only.",
      },
      { status: 400 }
    );
  }

  const trimmed = username.trim();
  const usernameLower = normalizeUsername(trimmed);

  if (isReservedUsername(usernameLower)) {
    return NextResponse.json({ error: "That username is reserved." }, { status: 400 });
  }

  try {
    const existingUser = await docClient.send(
      new GetCommand({ TableName: "InPlayer-Users", Key: { userId: user.userId } })
    );
    const previousUsernameLower = existingUser.Item?.usernameLower as string | undefined;

    if (previousUsernameLower === usernameLower) {
      return NextResponse.json({
        success: true,
        username: existingUser.Item?.username || trimmed,
      });
    }

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          // Claim the new handle — fails atomically if someone else grabs
          // it in the same instant.
          {
            Put: {
              TableName: "InPlayer-Usernames",
              Item: { usernameLower, username: trimmed, userId: user.userId },
              ConditionExpression: "attribute_not_exists(usernameLower)",
            },
          },
          // Release the old reservation, if there was one.
          ...(previousUsernameLower
            ? [
                {
                  Delete: {
                    TableName: "InPlayer-Usernames",
                    Key: { usernameLower: previousUsernameLower },
                    ConditionExpression: "userId = :uid",
                    ExpressionAttributeValues: { ":uid": user.userId },
                  },
                },
              ]
            : []),
          {
            Update: {
              TableName: "InPlayer-Users",
              Key: { userId: user.userId },
              UpdateExpression:
                "SET username = :username, usernameLower = :usernameLower, updatedAt = :updatedAt",
              ExpressionAttributeValues: {
                ":username": trimmed,
                ":usernameLower": usernameLower,
                ":updatedAt": new Date().toISOString(),
              },
            },
          },
        ],
      })
    );

    return NextResponse.json({ success: true, username: trimmed });
  } catch (err: unknown) {
    console.error("Username claim failed:", err);

    const name = (err as { name?: string } | undefined)?.name;
    if (name === "TransactionCanceledException") {
      return NextResponse.json(
        { error: "That username was just taken — please try another." },
        { status: 409 }
      );
    }

    // Almost certainly means InPlayer-Usernames doesn't exist yet in
    // DynamoDB (usernameLower as the partition key).
    return NextResponse.json(
      { error: "Usernames aren't available yet. Please try again shortly." },
      { status: 503 }
    );
  }
}
