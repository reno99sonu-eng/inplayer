import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import mux from "@/app/lib/mux";

interface Params {
  params: Promise<{ videoId: string }>;
}

// If a video has been sitting in "preparing" for longer than this, treat
// it as stuck rather than genuinely in-flight and allow a fresh request.
// A normal static rendition finishes in well under this window — the only
// way a video sits here longer is if the webhook that was supposed to
// flip it to "ready" never landed (e.g. Mux delivered it once, our lookup
// failed to match it, and Mux — having gotten a 200 back — never retried).
// Since that earlier delivery is gone for good, the only way out is a
// brand new rendition request, which produces a brand new webhook
// delivery and a fresh chance to succeed.
const STUCK_THRESHOLD_MS = 3 * 60 * 1000;

// Called the first time a viewer hits Download on a video that never got
// a downloadable MP4 requested at upload time (any video uploaded before
// this feature shipped). Idempotent — safe to call repeatedly while
// "preparing", and a no-op once "ready". Self-heals a video stuck in
// "preparing" past STUCK_THRESHOLD_MS by requesting a fresh rendition.
export async function POST(request: NextRequest, { params }: Params) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json(
      { error: "Please sign in to download." },
      { status: 401 }
    );
  }

  const { videoId } = await params;

  const result = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
    })
  );

  const video = result.Item;

  if (!video) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  if (video.contentType === "short") {
    return NextResponse.json(
      { error: "Shorts aren't downloadable." },
      { status: 400 }
    );
  }

  if (video.downloadStatus === "ready") {
    return NextResponse.json({
      status: "ready",
      fileName: video.downloadFileName,
    });
  }

  if (video.downloadStatus === "preparing") {
    const requestedAt = video.downloadRequestedAt
      ? new Date(video.downloadRequestedAt).getTime()
      : 0;
    const stuckFor = Date.now() - requestedAt;

    if (stuckFor < STUCK_THRESHOLD_MS) {
      return NextResponse.json({ status: "preparing" });
    }

    // Stuck past the threshold. Before requesting a brand new rendition
    // (which risks Mux rejecting a duplicate request for a resolution
    // that may already exist), check the asset directly — this is
    // exactly how a video ends up stuck here: the rendition actually
    // finished successfully on Mux's side, but the one webhook delivery
    // that would have told us so got lost, and Mux never retries a
    // delivery it already got a 200 back for. If it's already ready, sync
    // it immediately instead of making the viewer wait through another
    // full render cycle for work that's already done.
    try {
      const asset = await mux.video.assets.retrieve(video.muxAssetId);
      const readyFile = asset.static_renditions?.files?.find(
        (file) => file.resolution === "highest" && file.status === "ready"
      );

      if (readyFile?.name) {
        await docClient.send(
          new UpdateCommand({
            TableName: "InPlayer-Videos",
            Key: { videoId },
            UpdateExpression:
              "SET downloadStatus = :status, downloadFileName = :fileName",
            ExpressionAttributeValues: {
              ":status": "ready",
              ":fileName": readyFile.name,
            },
          })
        );

        return NextResponse.json({ status: "ready", fileName: readyFile.name });
      }
    } catch (err) {
      console.error(
        `Failed to check asset state for ${video.muxAssetId}:`,
        err
      );
      // Fall through and try requesting a fresh rendition instead.
    }
    // Not already ready on Mux's side — fall through and request a fresh
    // rendition below, same as a video that's never been requested at all.
  }

  if (!video.muxAssetId) {
    return NextResponse.json(
      { error: "This video isn't ready yet." },
      { status: 409 }
    );
  }

  try {
    // "highest" — same quality tier requested for every new upload, so
    // videos backfilled this way end up identical to freshly-uploaded
    // ones once ready.
    await mux.video.assets.createStaticRendition(video.muxAssetId, {
      resolution: "highest",
    });
  } catch (err) {
    console.error(
      `Failed to request static rendition for asset ${video.muxAssetId}:`,
      err
    );
    return NextResponse.json(
      { error: "Couldn't start preparing this download. Please try again." },
      { status: 502 }
    );
  }

  await docClient.send(
    new UpdateCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
      UpdateExpression: "SET downloadStatus = :status, downloadRequestedAt = :requestedAt",
      ExpressionAttributeValues: {
        ":status": "preparing",
        ":requestedAt": new Date().toISOString(),
      },
    })
  );

  // Mux's video.asset.static_rendition.ready webhook (see
  // app/api/webhooks/mux/route.ts) flips this to "ready" once the MP4
  // actually finishes encoding — the client polls app/api/videos/[videoId]/status
  // in the meantime.
  return NextResponse.json({ status: "preparing" });
}
