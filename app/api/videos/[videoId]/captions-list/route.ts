import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { CAPTION_TARGETS } from "@/app/lib/captions";

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
    const languages = CAPTION_TARGETS.filter((t) => availableCodes.includes(t.code));

    return NextResponse.json({ languages }, {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Failed to load captions list:", err);
    return NextResponse.json({ languages: [] });
  }
}
