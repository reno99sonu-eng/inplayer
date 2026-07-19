import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import mux from "@/app/lib/mux";
import { docClient } from "@/app/lib/dynamodb";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // unwrap() both verifies the signature AND parses the event in one
  // step, using the webhookSecret already configured on the mux client.
  // It throws if the signature is missing/invalid.
  let event;

  try {
    event = mux.webhooks.unwrap(rawBody, request.headers);
  } catch (err) {
    console.error("Mux webhook verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

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