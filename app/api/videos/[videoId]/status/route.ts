import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

interface Params {
  params: Promise<{ videoId: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { videoId } = await params;

  const result = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
    })
  );

  if (!result.Item) {
    return NextResponse.json({ status: "not_found" });
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