import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { VALID_REPORT_REASONS } from "@/app/lib/reportReasons";

// New table (not yet created in AWS as of this change — see delivery
// notes): partition key reportId (String, random per report). Every
// report is its own row — a video (or comment, or message — see
// targetType below) can be reported any number of times by different
// people, so there's no natural per-target/per-user primary key to key
// off. "Have I already reported this one" is answered with a Scan (same
// tradeoff app/api/likes already makes for its own count lookup — fine at
// InPlayer's current scale).
const REPORTS_TABLE = "InPlayer-Reports";

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

  const body = await request.json();
  const { reason, details } = body;

  if (!VALID_REPORT_REASONS.includes(reason)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // targetType generalizes this beyond just videos — a comment report
  // needs its videoId + commentId, a message report needs its
  // conversationId + messageId. Defaults to "video" so the pre-existing
  // caller (VideoOptionsMenu, which only ever sends videoId) keeps working
  // completely unchanged.
  const targetType =
    body.targetType === "comment" || body.targetType === "message"
      ? body.targetType
      : "video";

  let target: Record<string, unknown>;
  if (targetType === "video") {
    if (!body.videoId) {
      return NextResponse.json({ error: "videoId is required." }, { status: 400 });
    }
    target = { videoId: body.videoId };
  } else if (targetType === "comment") {
    if (!body.videoId || !body.commentId) {
      return NextResponse.json(
        { error: "videoId and commentId are required." },
        { status: 400 }
      );
    }
    target = { videoId: body.videoId, commentId: body.commentId };
  } else {
    if (!body.conversationId || !body.messageId) {
      return NextResponse.json(
        { error: "conversationId and messageId are required." },
        { status: 400 }
      );
    }
    target = { conversationId: body.conversationId, messageId: body.messageId };
  }

  try {
    await docClient.send(
      new PutCommand({
        TableName: REPORTS_TABLE,
        Item: {
          reportId: randomUUID(),
          targetType,
          ...target,
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
