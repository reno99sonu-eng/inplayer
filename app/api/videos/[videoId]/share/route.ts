import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

// Records a share. Fires when someone actually completes a share (the OS
// share sheet was used, or the link was copied) — same "honest, simple
// starting point" as the view counter: +1 per share action, no dedup or
// unique-sharer tracking. No auth required, matching the share button
// itself (anyone watching can share, signed in or not).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId },
        UpdateExpression: "SET #shareCount = if_not_exists(#shareCount, :zero) + :inc",
        ExpressionAttributeNames: { "#shareCount": "shareCount" },
        ExpressionAttributeValues: { ":inc": 1, ":zero": 0 },
      })
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to record share:", err);
    // A share counter failing to write shouldn't surface as an error to the
    // person sharing — the share sheet/copy already happened for them.
    return NextResponse.json({ success: true });
  }
}
