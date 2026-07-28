import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

// New table (not yet created in AWS as of this change — see delivery
// notes): partition key reportId (String, random per report). Every
// report is its own row — a video can be reported any number of times by
// different people, so there's no natural per-video/per-user primary key
// to key off. "Have I already reported this one" is answered with a Scan
// (same tradeoff app/api/likes already makes for its own count lookup —
// fine at InPlayer's current scale).
const REPORTS_TABLE = "InPlayer-Reports";

const VALID_REASONS = [
  "spam",
  "harassment",
  "sexual_content",
  "hate_speech",
  "violence",
  "misinformation",
  "copyright",
  "other",
];

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId");
  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

  let reported = false;

  try {
    const user = await verifyAuth(request);

    const result = await docClient.send(
      new ScanCommand({
        TableName: REPORTS_TABLE,
        FilterExpression: "videoId = :videoId AND reporterId = :reporterId",
        ExpressionAttributeValues: {
          ":videoId": videoId,
          ":reporterId": user.userId,
        },
      })
    );

    reported = (result.Items || []).length > 0;
  } catch {
    // Not signed in, or the table doesn't exist yet — the honest default
    // is "not reported"; this never fakes a reported state.
  }

  return NextResponse.json({ reported });
}

export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { videoId, reason, details } = await request.json();

  if (!videoId || !VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    await docClient.send(
      new PutCommand({
        TableName: REPORTS_TABLE,
        Item: {
          reportId: randomUUID(),
          videoId,
          reporterId: user.userId,
          reason,
          details: (details || "").toString().trim().slice(0, 1000),
          status: "open",
          createdAt: new Date().toISOString(),
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Reports table request failed (table may not exist yet):", err);
    return NextResponse.json(
      { error: "Couldn't submit your report right now. Please try again." },
      { status: 500 }
    );
  }
}
