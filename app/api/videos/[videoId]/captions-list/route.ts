import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { CAPTION_TARGETS } from "@/app/lib/captions";
import { isMeaningfulSpeechTranscript } from "@/app/lib/vttChunker";

interface Params {
  params: Promise<{ videoId: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { videoId } = await params;

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId },
      })
    );

    const captionsVtt = result.Item?.captionsVtt as Record<string, string> | undefined;
    if (!captionsVtt || typeof captionsVtt !== "object") {
      return NextResponse.json({ languages: [] });
    }

    const availableCodes = Object.keys(captionsVtt);
    const hasMeaningful = availableCodes.some((code) => {
      const vtt = captionsVtt[code];
      return (
        typeof vtt === "string" &&
        vtt.startsWith("WEBVTT") &&
        isMeaningfulSpeechTranscript(vtt)
      );
    });

    if (!hasMeaningful) {
      return NextResponse.json({ languages: [] });
    }

    // Since on-demand Bhashini translation is available for all regional languages,
    // return all CAPTION_TARGETS so viewers can select any supported Indian language
    return NextResponse.json(
      { languages: CAPTION_TARGETS },
      {
        headers: {
          "Cache-Control": "public, max-age=3600",
        },
      }
    );
  } catch (err) {
    console.error("Failed to load captions list:", err);
    return NextResponse.json({ languages: [] });
  }
}
