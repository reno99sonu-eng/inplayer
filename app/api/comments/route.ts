import { NextRequest, NextResponse } from "next/server";
import {
  QueryCommand,
  PutCommand,
  DeleteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: "InPlayer-Comments",
      KeyConditionExpression: "videoId = :videoId",
      ExpressionAttributeValues: { ":videoId": videoId },
    })
  );

  const comments = (result.Items || []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json({ comments });
}

export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in to comment." }, { status: 401 });
  }

  const { videoId, text } = await request.json();

  if (!videoId || !text?.trim()) {
    return NextResponse.json({ error: "Comment text is required." }, { status: 400 });
  }

  if (text.length > 1000) {
    return NextResponse.json({ error: "Comment is too long." }, { status: 400 });
  }

  const comment = {
    videoId,
    commentId: randomUUID(),
    userId: user.userId,
    userName: user.name || "Anonymous",
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: "InPlayer-Comments",
      Item: comment,
    })
  );

  return NextResponse.json({ comment });
}

export async function DELETE(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const videoId = request.nextUrl.searchParams.get("videoId");
  const commentId = request.nextUrl.searchParams.get("commentId");

  if (!videoId || !commentId) {
    return NextResponse.json(
      { error: "videoId and commentId are required." },
      { status: 400 }
    );
  }

  const existing = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Comments",
      Key: { videoId, commentId },
    })
  );

  if (!existing.Item) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  }

  if (existing.Item.userId !== user.userId) {
    return NextResponse.json(
      { error: "You can only delete your own comments." },
      { status: 403 }
    );
  }

  await docClient.send(
    new DeleteCommand({
      TableName: "InPlayer-Comments",
      Key: { videoId, commentId },
    })
  );

  return NextResponse.json({ success: true });
}