import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ videoId: string }>;
}

// Records one view. Same "views += 1 on page load" counter the website's
// own /watch/[videoId] page already increments server-side via next/server's
// after() the moment a browser loads that page — but THAT only ever fires
// for a browser navigating to that literal URL. It never ran for:
//   - the Android app (which never loads that HTML page — it only ever
//     calls JSON APIs), for ANY content type, video/short/music alike;
//   - the website's own Raftaar/Shorts feed, which is one continuously-
//     scrolling page, not a series of per-short page loads.
// That gap is exactly why a video could collect real likes (POST /api/
// likes works from anywhere, including both of the above) while its view
// count stayed frozen at the 0 it was created with — a like implies at
// least one real view, so "0 views, 1 like" was never actually possible;
// the views simply were never being counted for that surface.
//
// This route is the one shared place both of those call into instead.
// /watch/[videoId]'s own increment is left exactly as it was — this is
// purely additive, so nothing already working changes.
//
// Deliberately unauthenticated and undeduplicated, matching the existing
// counter's own documented philosophy exactly ("not unique-visitor
// tracking, but an honest, simple starting point") — every viewer's watch
// should count, signed in or not, and adding real dedup here would make
// this counter behave differently from the one it's mirroring.
export async function POST(request: NextRequest, { params }: Params) {
  const { videoId } = await params;
  if (!videoId) {
    return NextResponse.json({ error: "videoId is required." }, { status: 400 });
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId },
        UpdateExpression: "SET #views = if_not_exists(#views, :zero) + :inc",
        ExpressionAttributeNames: { "#views": "views" },
        ExpressionAttributeValues: { ":inc": 1, ":zero": 0 },
      })
    );
  } catch (err) {
    console.error("Failed to record view:", err);
    // Fall through — the daily bucket below is independent and still worth
    // trying, same as the two independent try/catches in /watch/[videoId].
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Video-Daily-Views",
        Key: { date: today, videoId },
        UpdateExpression: "SET #v = if_not_exists(#v, :zero) + :inc",
        ExpressionAttributeNames: { "#v": "views" },
        ExpressionAttributeValues: { ":inc": 1, ":zero": 0 },
      })
    );
  } catch (err) {
    console.error("Failed to record daily view:", err);
  }

  // Always 200: a viewer's playback must never appear to fail because a
  // best-effort counter write had trouble — same reasoning as every other
  // fire-and-forget analytics call in this codebase.
  return NextResponse.json({ ok: true });
}
