import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { verifyWebhookSignature } from "@mux/mux-node";
import { docClient } from "@/app/lib/dynamodb";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("mux-signature") || "";

  let isValid = false;

  try {
    isValid = Boolean(
      verifyWebhookSignature(rawBody, signature, process.env.MUX_WEBHOOK_SECRET!)
    );
  } catch (err) {
    console.error("Mux webhook signature check failed:", err);
    isValid = false;
  }

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.type === "video.asset.ready") {
    const asset = event.data;
    const uploadId = asset.upload_id;

    if (!uploadId) {
      console.error("video.asset.ready had no upload_id — asset:", asset.id);
      return NextResponse.json({ received: true });
    }

    const playbackId = asset.playback_ids?.[0]?.id;

    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId: uploadId },
        UpdateExpression:
          "SET #status = :status, muxAssetId = :assetId, muxPlaybackId = :playbackId, #duration = :duration, thumbnailUrl = :thumbnailUrl",
        ExpressionAttributeNames: {
          "#status": "status",
          "#duration": "duration",
        },
        ExpressionAttributeValues: {
          ":status": "ready",
          ":assetId": asset.id,
          ":playbackId": playbackId || "",
          ":duration": asset.duration || 0,
          ":thumbnailUrl": playbackId
            ? `https://image.mux.com/${playbackId}/thumbnail.jpg`
            : "",
        },
      })
    );
  }

  if (event.type === "video.asset.errored") {
    const asset = event.data;
    const uploadId = asset.upload_id;

    if (uploadId) {
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId: uploadId },
          UpdateExpression: "SET #status = :status",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":status": "error" },
        })
      );
    }
  }

  // Always respond 200 once we've processed the event, so Mux doesn't
  // keep retrying an event we've already handled.
  return NextResponse.json({ received: true });
}