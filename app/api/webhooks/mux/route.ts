import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import mux from "@/app/lib/mux";
import { docClient } from "@/app/lib/dynamodb";

// Static-rendition webhook events identify the asset only via the Mux
// Asset ID (event.object.id) — never our own videoId — so unlike the
// other handlers below (which get to key straight off upload_id), this
// one has to look our record up. There's no GSI on muxAssetId yet, so
// this follows the same Scan-based lookup pattern already used elsewhere
// in this codebase (app/api/my-videos, app/shorts, etc.) rather than
// introducing a new indexing strategy just for this.
async function findVideoByAssetId(assetId: string) {
  const result = await docClient.send(
    new ScanCommand({
      TableName: "InPlayer-Videos",
      FilterExpression: "muxAssetId = :assetId",
      ExpressionAttributeValues: { ":assetId": assetId },
    })
  );

  return result.Items?.[0];
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // unwrap() both verifies the signature AND parses the event in one
  // step, using the webhookSecret already configured on the mux client.
  // It throws if the signature is missing/invalid.
  let event;

  try {
    event = await mux.webhooks.unwrap(rawBody, request.headers);
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

    // Kick off automatic caption generation on the asset's primary audio
    // track (applies to both videos and Shorts — unlike Download, this is
    // a universally-useful accessibility feature, not gated to one content
    // type). Mux runs speech recognition against the track and, once
    // done, adds a real subtitle text track to the asset. Mux Player
    // already has defaultHiddenCaptions={false} set in VideoPlayer.tsx, so
    // it picks the finished track up on its own straight from the
    // playback manifest the moment it's ready — no DB column, no
    // polling, no extra UI needed on our end. "auto" lets Mux detect
    // whichever language is actually spoken instead of assuming every
    // upload is English, since creators here aren't all speaking the same
    // language. Silent videos (no audio track) simply have nothing to
    // caption — that's an expected case, not an error.
    const audioTrack = asset.tracks?.find(
      (track: { type?: string; id?: string }) => track.type === "audio"
    );

    if (audioTrack?.id) {
      try {
        await mux.video.assets.generateSubtitles(asset.id, audioTrack.id, {
          generated_subtitles: [
            { language_code: "auto", name: "Auto-generated" },
          ],
        });
      } catch (err) {
        // Never let a captions failure affect the asset itself finishing
        // up as "ready" above — the video is already fully playable
        // without captions, and generating them is best-effort.
        console.error("Caption generation request failed:", err);
      }
    }
  }

  // Fires once a generated subtitle track (or any text track) finishes
  // processing. Nothing to persist here — see the comment above, Mux
  // Player already surfaces the track on its own — this is just for
  // server-side visibility into whether generation actually succeeded.
  if (event.type === "video.asset.track.ready") {
    const track = event.data;
    if (track.text_source === "generated_vod") {
      console.log(
        `Captions ready — asset ${event.object.id}, track ${track.id}`
      );
    }
  }

  if (event.type === "video.asset.track.errored") {
    console.error(
      `Track generation failed — asset ${event.object.id}:`,
      event.data
    );
  }

  // Fires once the downloadable "highest" MP4 we requested at upload time
  // (or via the on-demand backfill in app/api/videos/[videoId]/prepare-download)
  // has actually finished encoding and is ready to be fetched.
  if (event.type === "video.asset.static_rendition.ready") {
    const rendition = event.data;
    const assetId = event.object.id;

    if (rendition.status === "ready" && rendition.name) {
      const match = await findVideoByAssetId(assetId);

      if (match) {
        await docClient.send(
          new UpdateCommand({
            TableName: "InPlayer-Videos",
            Key: { videoId: match.videoId },
            UpdateExpression: "SET downloadStatus = :status, downloadFileName = :fileName",
            ExpressionAttributeValues: {
              ":status": "ready",
              ":fileName": rendition.name,
            },
          })
        );
      } else {
        console.error("static_rendition.ready: no video found for asset", assetId);
      }
    }
  }

  // The MP4 failed to generate — reset so a viewer's next Download click
  // (via prepare-download) retries instead of getting stuck "preparing"
  // forever.
  if (event.type === "video.asset.static_rendition.errored") {
    const assetId = event.object.id;
    const match = await findVideoByAssetId(assetId);

    if (match) {
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId: match.videoId },
          UpdateExpression: "SET downloadStatus = :status",
          ExpressionAttributeValues: { ":status": "errored" },
        })
      );
    }
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