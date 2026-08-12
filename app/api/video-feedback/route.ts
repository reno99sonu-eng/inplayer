import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

// PK userId, SK videoId — same tableMissing-tolerant convention as every
// other table in this codebase (see app/lib/sessions.ts): Reno creates this
// by hand in the AWS DynamoDB console, so every handler below fails soft
// instead of 500ing the whole feed while that hasn't happened yet.
export const VIDEO_FEEDBACK_TABLE = "InPlayer-Video-Feedback";

// Real, persisted "Interested" / "Not Interested" signal a signed-in viewer
// can leave on any video — wired up in two places that both hit this same
// endpoint: the compact buttons under each homepage video card
// (HomeVideoCard, RecommendationFeed.tsx) and the shared three-dot "More
// options" menu (VideoOptionsMenu.tsx), which also means every place that
// menu is rendered — the watch page AND, once wired up there too, the
// Raftaar/Shorts shelf cards (ShortsShelf.tsx) — gets the same real
// buttons, not a separate one-off implementation per surface.
//
// GET returns the signed-in viewer's full feedback map so callers can both
// highlight whichever button is already active for a video AND filter
// "not_interested" videos out of whatever feed they're rendering (see
// RecommendationFeed.tsx) — that filtering is what makes this an actual
// working recommendation signal instead of a button that does nothing.
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    // Anonymous visitor — nothing to report, not an error. Every caller
    // treats an empty map the same as "nothing marked yet."
    return NextResponse.json({ feedback: {} });
  }

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: VIDEO_FEEDBACK_TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": user.userId },
      })
    );
    const feedback: Record<string, string> = {};
    for (const item of result.Items || []) {
      if (item.videoId && item.feedback) feedback[item.videoId as string] = item.feedback as string;
    }
    return NextResponse.json({ feedback });
  } catch (err) {
    console.error("video-feedback: query failed (table may not exist yet):", err);
    return NextResponse.json({ feedback: {} });
  }
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const videoId = body?.videoId;
  const value = body?.feedback;

  if (!videoId || typeof videoId !== "string" || (value !== "interested" && value !== "not_interested")) {
    return NextResponse.json({ error: "videoId and a valid feedback value are required." }, { status: 400 });
  }

  try {
    // Clicking the SAME button again clears it — the same "tap to undo"
    // convention as the Watch Later / Save quick-toggles elsewhere in
    // VideoOptionsMenu.tsx, instead of only ever being able to add.
    const existing = await docClient.send(
      new GetCommand({ TableName: VIDEO_FEEDBACK_TABLE, Key: { userId: user.userId, videoId } })
    );

    if (existing.Item?.feedback === value) {
      await docClient.send(
        new DeleteCommand({ TableName: VIDEO_FEEDBACK_TABLE, Key: { userId: user.userId, videoId } })
      );
      return NextResponse.json({ feedback: null });
    }

    await docClient.send(
      new PutCommand({
        TableName: VIDEO_FEEDBACK_TABLE,
        Item: { userId: user.userId, videoId, feedback: value, createdAt: new Date().toISOString() },
      })
    );
    return NextResponse.json({ feedback: value });
  } catch (err) {
    console.error("video-feedback: write failed (table may not exist yet):", err);
    return NextResponse.json({ error: "Couldn't save your feedback right now." }, { status: 500 });
  }
}
