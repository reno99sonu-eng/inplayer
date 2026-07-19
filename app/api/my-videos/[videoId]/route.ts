import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import mux from "@/app/lib/mux";

interface Params {
  params: Promise<{ videoId: string }>;
}

async function verifyOwnership(videoId: string, userId: string) {
  const result = await docClient.send(
    new GetCommand({ TableName: "InPlayer-Videos", Key: { videoId } })
  );

  if (!result.Item) {
    return { error: "Video not found.", status: 404 } as const;
  }

  if (result.Item.uploaderId !== userId) {
    return { error: "You don't own this video.", status: 403 } as const;
  }

  return { video: result.Item } as const;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { videoId } = await params;
  const ownership = await verifyOwnership(videoId, user.userId);

  if ("error" in ownership) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  const { title, description, category } = await request.json();

  if (!title?.trim() || !category?.trim()) {
    return NextResponse.json(
      { error: "Title and category are required." },
      { status: 400 }
    );
  }

  await docClient.send(
    new UpdateCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
      UpdateExpression:
        "SET title = :title, description = :description, category = :category",
      ExpressionAttributeValues: {
        ":title": title.trim(),
        ":description": description?.trim() || "",
        ":category": category.trim(),
      },
    })
  );

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { videoId } = await params;
  const ownership = await verifyOwnership(videoId, user.userId);

  if ("error" in ownership) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  // Also delete the underlying Mux asset, so storage isn't kept (and
  // billed) for a video that no longer exists in the app.
  if (ownership.video.muxAssetId) {
    try {
      await mux.video.assets.delete(ownership.video.muxAssetId);
    } catch (err) {
      console.error("Failed to delete Mux asset (continuing anyway):", err);
    }
  }

  await docClient.send(
    new DeleteCommand({ TableName: "InPlayer-Videos", Key: { videoId } })
  );

  return NextResponse.json({ success: true });
}