import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import mux from "@/app/lib/mux";
import { docClient } from "@/app/lib/dynamodb";
import { READY_VIDEOS_TAG } from "@/app/lib/videoStore";

// Best-to-worst download quality order. Used to pick a sensible default
// (`downloadFileName`) from whichever renditions have finished so far.
const QUALITY_PREFERENCE = [
  "highest",
  "2160p",
  "1440p",
  "1080p",
  "720p",
  "540p",
  "480p",
  "360p",
  "270p",
];

function pickBestName(renditions: Record<string, string>): string {
  for (const q of QUALITY_PREFERENCE) {
    if (renditions[q]) return renditions[q];
  }
  const values = Object.values(renditions);
  return values[0] || "";
}

// Static-rendition webhook events identify the asset only via the Mux
// Asset ID (event.object.id) — never our own videoId — so unlike the
// other handlers below (which get to key straight off upload_id), this
// one has to look our record up. There's no GSI on muxAssetId yet, so
// this follows the same Scan-based lookup pattern already used elsewhere
// in this codebase (app/api/my-videos, app/shorts, etc.) rather than
// introducing a new indexing strategy just for this.
//
// DynamoDB caps a single Scan response at ~1MB, and silently returns only
// that page — it does NOT automatically follow the rest of the table.
// A one-shot Scan (no LastEvaluatedKey loop) can therefore miss a
// genuinely-matching item once the table outgrows that page, with no
// error raised — it just looks like "no video found". Looping here
// guarantees the whole table gets checked no matter how large it gets.
async function findVideoByAssetId(assetId: string) {
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        FilterExpression: "muxAssetId = :assetId",
        ExpressionAttributeValues: { ":assetId": assetId },
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    if (result.Items?.[0]) return result.Items[0];
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return undefined;
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

    // The listing pages read a 30-second cached video list (see
    // lib/videoStore) — bust it now so this freshly-ready video shows up
    // on the homepage immediately instead of waiting out the cache.
    // ("max" is the profile Next 16 requires as the second argument —
    // it's what Next's own upgrade codemod inserts for plain tag busts.)
    revalidateTag(READY_VIDEOS_TAG, "max");

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

  // Fires once one of the downloadable static MP4 renditions we requested
  // (1080p / 720p / 480p, at upload time or via the on-demand backfill in
  // app/api/videos/[videoId]/prepare-download) finishes encoding. Each
  // quality fires its own event, so we accumulate them into a per-quality
  // map (resolution -> filename) and keep downloadFileName pointing at the
  // best available as the default.
  if (event.type === "video.asset.static_rendition.ready") {
    const rendition = event.data;
    const assetId = event.object.id;

    if (rendition.status === "ready" && rendition.name) {
      const match = await findVideoByAssetId(assetId);

      if (match) {
        const resolution = String(
          rendition.resolution || rendition.name
        ).replace(/\.(mp4|m4a)$/, "");
        const mergedRenditions: Record<string, string> = {
          ...((match.downloadRenditions || {}) as Record<string, string>),
          [resolution]: rendition.name,
        };

        await docClient.send(
          new UpdateCommand({
            TableName: "InPlayer-Videos",
            Key: { videoId: match.videoId },
            UpdateExpression:
              "SET downloadStatus = :status, downloadRenditions = :renditions, downloadFileName = :best",
            ExpressionAttributeValues: {
              ":status": "ready",
              ":renditions": mergedRenditions,
              ":best": pickBestName(mergedRenditions),
            },
          })
        );
      } else {
        // Returning 200 here would tell Mux this event was delivered
        // successfully — Mux never sends it again after that, which
        // would leave the matching video's download permanently stuck in
        // "preparing" with no way to recover (this is exactly what
        // happened before this fix). Returning a non-2xx instead makes
        // Mux retry this same delivery on its own backoff schedule, so a
        // transient lookup issue gets a real chance to resolve instead of
        // silently stranding the video.
        console.error("static_rendition.ready: no video found for asset", assetId);
        return NextResponse.json(
          { error: "No matching video found, will retry" },
          { status: 500 }
        );
      }
    }
  }

  // A rendition failed to generate. With three qualities requested, one
  // erroring (or being skipped because it's higher than the source) must
  // NOT knock the whole download offline if another quality already
  // succeeded — only mark the download errored when nothing is ready yet,
  // so a viewer's next Download click (via prepare-download) retries.
  if (event.type === "video.asset.static_rendition.errored") {
    const assetId = event.object.id;
    const match = await findVideoByAssetId(assetId);

    if (match) {
      const hasReady =
        Object.keys(match.downloadRenditions || {}).length > 0;

      if (!hasReady) {
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