import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

interface Params {
  params: Promise<{ videoId: string; lang: string }>;
}

// Serves a translated subtitle file (WebVTT) for a video. Mux fetches
// this URL once when the track is registered via createTrack (see the
// webhook), after which the captions live inside Mux's own playback
// manifest like any native subtitle track.
export async function GET(request: NextRequest, { params }: Params) {
  const { videoId, lang } = await params;

  const result = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
    })
  );

  const vtt = result.Item?.captionsVtt?.[lang];

  if (typeof vtt !== "string" || !vtt.startsWith("WEBVTT")) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return new NextResponse(vtt, {
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      // Immutable once generated — cache aggressively.
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
