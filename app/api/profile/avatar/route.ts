import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
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
    new GetCommand({
      TableName: "InPlayer-Users",
      Key: { userId: user.userId },
    })
  );

  return NextResponse.json({ avatarUrl: result.Item?.avatarUrl || null });
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

  await docClient.send(
    new PutCommand({
      TableName: "InPlayer-Users",
      Item: {
        userId: user.userId,
        avatarUrl,
        updatedAt: new Date().toISOString(),
      },
    })
  );

  return NextResponse.json({ success: true });
}