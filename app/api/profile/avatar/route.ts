import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { ensureUsername } from "@/app/lib/ensureUsername";

const DEFAULT_SOCIAL_LINKS = { social: {}, other: [] };

// This is the one place AuthProvider's refreshUser() reads on every app
// load to bootstrap the shared user object — so alongside the avatar it
// also returns the handful of other InPlayer-Users fields the client
// needs everywhere (username, privacy, social links), rather than making
// every page fetch a second endpoint just to know "do I have a username
// yet."
export async function GET(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  await ensureUsername(user.userId);

const result = await docClient.send(
  new GetCommand({
    TableName: "InPlayer-Users",
    Key: { userId: user.userId },
  })
);

  return NextResponse.json({
    avatarUrl: result.Item?.avatarUrl || null,
    username: result.Item?.username || null,
    usernamePrivacy: result.Item?.usernamePrivacy || "public",
    socialLinks: result.Item?.socialLinks || DEFAULT_SOCIAL_LINKS,
    age: typeof result.Item?.age === "number" ? result.Item.age : null,
  });
}

export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { avatarUrl } = await request.json();

  if (!avatarUrl || typeof avatarUrl !== "string") {
    return NextResponse.json({ error: "Invalid image data." }, { status: 400 });
  }

  // DynamoDB items are capped at 400KB total — leave headroom for
  // encoding overhead and the rest of the item.
  if (avatarUrl.length > 350_000) {
    return NextResponse.json(
      { error: "That image is too large. Please choose a smaller photo." },
      { status: 400 }
    );
  }

  // UpdateCommand, not PutCommand — this item also carries username,
  // usernamePrivacy, and socialLinks (see app/api/username and
  // app/api/profile/settings). A Put here would silently replace the
  // whole item and wipe those out every time someone just changes their
  // photo.
  await docClient.send(
    new UpdateCommand({
      TableName: "InPlayer-Users",
      Key: { userId: user.userId },
      UpdateExpression: "SET avatarUrl = :avatarUrl, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":avatarUrl": avatarUrl,
        ":updatedAt": new Date().toISOString(),
      },
    })
  );

  return NextResponse.json({ success: true });
}
