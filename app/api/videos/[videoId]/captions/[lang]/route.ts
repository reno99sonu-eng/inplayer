import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { splitLongVttCues, isMeaningfulSpeechTranscript } from "@/app/lib/vttChunker";

interface Params {
  params: Promise<{ videoId: string; lang: string }>;
}

// Serves a translated subtitle file (WebVTT) for a video. Automatically
// chunks long paragraph text into short 1-line/2-line YouTube-style cues.
export async function GET(request: NextRequest, { params }: Params) {
  const { videoId, lang } = await params;

  const result = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
    })
  );

  const rawVtt = result.Item?.captionsVtt?.[lang];

  if (typeof rawVtt !== "string" || !rawVtt.startsWith("WEBVTT") || !isMeaningfulSpeechTranscript(rawVtt)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Chunk long cues into short 1-2 line subtitle items
  const cleanVtt = splitLongVttCues(rawVtt);

  return new NextResponse(cleanVtt, {
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
