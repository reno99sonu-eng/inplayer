import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import mux from "@/app/lib/mux";

// The other half of the live-stream-to-VOD pipeline started in
// app/api/live/ivs-create/route.ts (which attaches a Recording
// Configuration so IVS auto-records every stream to S3) and finished in
// app/api/webhooks/mux/route.ts (which picks up the Mux asset this route
// creates and, once Mux says it's actually ready, flips the video to
// "ready" exactly like a normal upload).
//
// This route is never called by IVS directly — IVS only publishes
// "Recording State Change" events to Amazon EventBridge. An EventBridge
// Rule (created by hand in the AWS console, see the setup doc) matches
// those events and an API Destination forwards them here as a plain POST,
// with a shared secret in a header standing in for the signature
// verification a real webhook provider would normally give us. Until that
// EventBridge Rule + API Destination + IVS_RECORDING_CONFIG_ARN are all set
// up, this route simply never receives anything — a stream ending still
// behaves exactly as it did before this pipeline existed (stuck on
// "processing"), which is the honest, safe default rather than a silent
// half-working state.
//
// IVS's own recommendation (their docs are explicit about this) is to only
// act once "Recording End" arrives — the manifest/segment files aren't
// guaranteed to be fully written before then, even though "Recording Start"
// fires much earlier.
export async function POST(request: NextRequest) {
  const configuredSecret = process.env.IVS_RECORDING_WEBHOOK_SECRET;
  if (!configuredSecret) {
    console.error("ivs-recording webhook: IVS_RECORDING_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const provided = request.headers.get("x-ivs-webhook-secret") || "";
  if (provided !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // EventBridge wraps the actual IVS payload inside a top-level "detail"
  // object alongside its own envelope fields (detail-type, source, etc.) —
  // see the AWS docs' "IVS Recording State Change" example event.
  const detail = (body.detail || body) as Record<string, unknown>;
  const recordingStatus = detail.recording_status as string | undefined;
  // channel_name is the exact same string ivs-create/route.ts used as both
  // the IVS channel's `name` AND this video's own videoId — no separate
  // lookup/index needed, it's already the primary key.
  const videoId = detail.channel_name as string | undefined;

  if (!videoId || !recordingStatus) {
    return NextResponse.json({ received: true });
  }

  // Recording never got going at all (e.g. the S3 bucket in the Recording
  // Configuration was misconfigured or got deleted) — don't leave the
  // video hanging forever on "processing" with no path forward.
  if (recordingStatus === "Recording Start Failure" || recordingStatus === "Recording End Failure") {
    await docClient
      .send(
        new UpdateCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId },
          UpdateExpression: "SET #status = :status",
          ConditionExpression: "attribute_exists(videoId)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":status": "error" },
        })
      )
      .catch((err) => console.error("ivs-recording webhook: failure-status update failed:", err));
    return NextResponse.json({ received: true });
  }

  if (recordingStatus !== "Recording End") {
    // "Recording Start" — nothing to do yet, the stream is still live.
    return NextResponse.json({ received: true });
  }

  const bucket = detail.recording_s3_bucket_name as string | undefined;
  const prefix = detail.recording_s3_key_prefix as string | undefined;
  if (!bucket || !prefix) {
    console.error("ivs-recording webhook: Recording End event missing bucket/prefix", detail);
    return NextResponse.json({ received: true });
  }

  // Confirm this is really one of ours (and still sitting in the
  // "processing" placeholder app/api/live/end/route.ts leaves it in) before
  // spending a Mux ingest on it — a stream that was ended twice, or a
  // stale/duplicate EventBridge delivery, shouldn't create a second asset.
  const existing = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
      ProjectionExpression: "videoId, #st, ivsChannelArn, muxAssetId",
      ExpressionAttributeNames: { "#st": "status" },
    })
  );
  const item = existing.Item;
  if (!item || !item.ivsChannelArn || item.status !== "processing" || item.muxAssetId) {
    return NextResponse.json({ received: true });
  }

  // The bucket is expected to allow public reads under its ivs/v1/* prefix
  // (see the setup doc — this is what lets Mux fetch the HLS manifest and
  // every segment it references without a second round of per-object
  // signing). Nothing about this recording is linked from anywhere on the
  // public site until Mux finishes ingesting it and the fallback branch in
  // app/api/webhooks/mux/route.ts flips the video to "ready" — and the raw
  // S3 copy is deleted the moment that happens (see deleteS3Prefix there).
  const region = process.env.AWS_REGION || "ap-south-1";
  const masterUrl = `https://${bucket}.s3.${region}.amazonaws.com/${prefix}/media/hls/master.m3u8`;

  try {
    const asset = await mux.video.assets.create({
      inputs: [{ url: masterUrl }],
      playback_policy: ["public"],
    });

    // Stash the S3 location now (needed for cleanup once Mux is done) and
    // the new asset id — status deliberately stays "processing": Mux itself
    // hasn't finished ingesting yet, its own video.asset.ready webhook is
    // what actually moves this to "ready".
    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId },
        UpdateExpression:
          "SET muxAssetId = :assetId, liveRecordingS3Bucket = :bucket, liveRecordingS3Prefix = :prefix",
        ExpressionAttributeValues: {
          ":assetId": asset.id,
          ":bucket": bucket,
          ":prefix": prefix,
        },
      })
    );
  } catch (err) {
    console.error("ivs-recording webhook: Mux ingest failed for", videoId, err);
    await docClient
      .send(
        new UpdateCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId },
          UpdateExpression: "SET #status = :status",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":status": "error" },
        })
      )
      .catch(() => {});
  }

  return NextResponse.json({ received: true });
}
