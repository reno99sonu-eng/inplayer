import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { createNotification } from "@/app/lib/notifications";
import { verifyAuth } from "@/app/lib/verifyAuth";

// Records a share. Fires when someone actually completes a share (the OS
// share sheet was used, or the link was copied) — same "honest, simple
// starting point" as the view counter: +1 per share action, no dedup or
// unique-sharer tracking. No auth required, matching the share button
// itself (anyone watching can share, signed in or not).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

  try {
    const updatePromise = docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId },
        UpdateExpression: "SET #shareCount = if_not_exists(#shareCount, :zero) + :inc",
        ExpressionAttributeNames: { "#shareCount": "shareCount" },
        ExpressionAttributeValues: { ":inc": 1, ":zero": 0 },
      })
    );

    // Notify the video owner if possible
    try {
      const videoResult = await docClient.send(
        new GetCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId },
          ProjectionExpression: "videoId, title, uploaderId",
        })
      );
      const video = videoResult.Item;
      if (video && video.uploaderId) {
        let sharerName = "Someone";
        let sharerUserId: string | null = null;
        try {
          const authUser = await verifyAuth(request);
          sharerUserId = authUser.userId;
          if (authUser.name) sharerName = authUser.name;
          else if (authUser.email) sharerName = authUser.email.split("@")[0];
        } catch {
          // Anonymous or unsigned sharer
        }

        if (sharerUserId !== video.uploaderId) {
          await createNotification({
            userId: video.uploaderId,
            type: "share",
            message: `${sharerName} shared your video "${video.title || "video"}"`,
            videoId,
          });
        }
      }
    } catch (notifErr) {
      console.error("Failed to create share notification:", notifErr);
    }

    await updatePromise;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to record share:", err);
    // A share counter failing to write shouldn't surface as an error to the
    // person sharing — the share sheet/copy already happened for them.
    return NextResponse.json({ success: true });
  }
}
