import { NextRequest, NextResponse } from "next/server";
import { GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import mux from "@/app/lib/mux";

// Admin removal of any video or Short, regardless of who uploaded it —
// app/api/my-videos/[videoId]'s DELETE is the creator-owned equivalent
// (ownership-gated); this is the same real deletion (Mux asset + database
// row), just gated by requireAdmin instead of upload ownership, for
// moderation use.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId } = await params;
  if (!videoId) {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }

  const existing = await docClient.send(
    new GetCommand({ TableName: "InPlayer-Videos", Key: { videoId } })
  );
  if (!existing.Item) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (existing.Item.muxAssetId) {
    try {
      await mux.video.assets.delete(existing.Item.muxAssetId as string);
    } catch (err) {
      console.error("Admin delete: failed to delete Mux asset (continuing anyway):", err);
    }
  }

  await docClient.send(new DeleteCommand({ TableName: "InPlayer-Videos", Key: { videoId } }));

  return NextResponse.json({ success: true });
}
