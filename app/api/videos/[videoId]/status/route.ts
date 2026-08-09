import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import mux from "@/app/lib/mux";
import { getMuxThumbnailUrl } from "@/app/lib/muxThumbnail";

interface Params {
  params: Promise<{ videoId: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { videoId } = await params;

  let result = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
    })
  );

  if (!result.Item) {
    return NextResponse.json({ status: "not_found" });
  }

  // Self-heal: If webhooks are missed (e.g. local dev without ngrok) or delayed, check Mux directly
  if (result.Item.status === "processing") {
    try {
      const upload = await mux.video.uploads.retrieve(videoId);
      if (upload.asset_id) {
        const asset = await mux.video.assets.retrieve(upload.asset_id);
        if (asset.status === "ready") {
          const playbackId = asset.playback_ids?.find((id) => id.policy === "public")?.id;
          const signedPlaybackId = asset.playback_ids?.find((id) => id.policy === "signed")?.id;

          if (playbackId) {
            const isShort = result.Item.contentType === "short";
            const thumbnailUrl = getMuxThumbnailUrl(playbackId, isShort);

            const updateResult = await docClient.send(
              new UpdateCommand({
                TableName: "InPlayer-Videos",
                Key: { videoId },
                UpdateExpression:
                  "SET #status = :status, muxAssetId = :assetId, muxPlaybackId = :playbackId, #duration = :duration, thumbnailUrl = if_not_exists(customThumbnailUrl, :thumbnailUrl)" +
                  (signedPlaybackId ? ", muxSignedPlaybackId = :signedPlaybackId" : ""),
                ExpressionAttributeNames: {
                  "#status": "status",
                  "#duration": "duration",
                },
                ExpressionAttributeValues: {
                  ":status": "ready",
                  ":assetId": asset.id,
                  ":playbackId": playbackId,
                  ":duration": asset.duration || 0,
                  ":thumbnailUrl": thumbnailUrl,
                  ...(signedPlaybackId && { ":signedPlaybackId": signedPlaybackId }),
                },
                ReturnValues: "ALL_NEW",
              })
            );
            if (updateResult.Attributes) {
              result = { Item: updateResult.Attributes as any };
            }
          }
        } else if (asset.status === "errored") {
          const updateResult = await docClient.send(
            new UpdateCommand({
              TableName: "InPlayer-Videos",
              Key: { videoId },
              UpdateExpression: "SET #status = :status",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: { ":status": "error" },
              ReturnValues: "ALL_NEW",
            })
          );
          if (updateResult.Attributes) {
            result = { Item: updateResult.Attributes as any };
          }
        }
      }
    } catch (err) {
      console.error("Self-heal check failed for video", videoId, err);
    }
  }

  return NextResponse.json({
    status: result.Item.status,
    downloadStatus: result.Item.downloadStatus || "unavailable",
    downloadFileName: result.Item.downloadFileName,
    // Map of ready qualities: { "1080p": "1080p.mp4", ... }. Powers the
    // Download button's quality picker.
    downloadRenditions: result.Item.downloadRenditions || {},
    // Only meaningful once status is "ready" (set together by the
    // video.asset.ready webhook handler). Lets the upload flow's
    // post-processing thumbnail step build real candidate frame URLs the
    // moment they first become possible, instead of showing a picker that
    // can never have anything in it.
    muxPlaybackId: result.Item.muxPlaybackId || null,
    duration: result.Item.duration || 0,
    thumbnailUrl: result.Item.thumbnailUrl || null,
  });
}