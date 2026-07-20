import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import mux from "@/app/lib/mux";

interface Params {
  params: Promise<{ videoId: string }>;
}

// Called the first time a viewer hits Download on a video that never got
// a downloadable MP4 requested at upload time (any video uploaded before
// this feature shipped). Idempotent — safe to call repeatedly while
// "preparing", and a no-op once "ready".
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
    return NextResponse.json({ status: "preparing" });
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
      UpdateExpression: "SET downloadStatus = :status",
      ExpressionAttributeValues: { ":status": "preparing" },
    })
  );

  // Mux's video.asset.static_rendition.ready webhook (see
  // app/api/webhooks/mux/route.ts) flips this to "ready" once the MP4
  // actually finishes encoding — the client polls app/api/videos/[videoId]/status
  // in the meantime.
  return NextResponse.json({ status: "preparing" });
}
