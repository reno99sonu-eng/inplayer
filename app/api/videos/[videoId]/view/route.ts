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

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  let finalViews = 0;

  try {
    const updateResult = await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId },
        UpdateExpression: "SET #views = if_not_exists(#views, :zero) + :inc",
        ExpressionAttributeNames: { "#views": "views" },
        ExpressionAttributeValues: { ":inc": 1, ":zero": 0 },
        ReturnValues: "ALL_NEW",
      })
    );

    const updatedVideo = updateResult.Attributes;
    if (updatedVideo) {
      finalViews = Number(updatedVideo.views) || 0;
      // If this is a film episode with a seriesId, increment series views
      const targetSeriesId = updatedVideo.seriesId || body?.seriesId;
      if (targetSeriesId) {
        if (!updatedVideo.seriesId) {
          try {
            await docClient.send(
              new UpdateCommand({
                TableName: "InPlayer-Videos",
                Key: { videoId },
                UpdateExpression: "SET seriesId = :sid",
                ExpressionAttributeValues: { ":sid": targetSeriesId },
              })
            );
          } catch (linkErr) {
            console.warn("Could not backlink seriesId to video:", linkErr);
          }
        }
        try {
          const { incrementSeriesStats } = await import("@/app/lib/raftaarFilms");
          await incrementSeriesStats(targetSeriesId, "totalViews", 1);
        } catch (seriesErr) {
          console.error("Failed to increment series views:", seriesErr);
        }
      }

      // Check 100-view milestone for creator to unlock Raftaar Films eligibility notification
      const uploaderId = updatedVideo.uploaderId || updatedVideo.creatorId;
      if (uploaderId) {
        try {
          const userUpdate = await docClient.send(
            new UpdateCommand({
              TableName: "InPlayer-Users",
              Key: { userId: uploaderId },
              UpdateExpression: "SET #tv = if_not_exists(#tv, :zero) + :inc",
              ExpressionAttributeNames: { "#tv": "totalViews" },
              ExpressionAttributeValues: { ":inc": 1, ":zero": 0 },
              ReturnValues: "ALL_NEW",
            })
          );
          const userAttrs = userUpdate.Attributes;
          if (
            userAttrs &&
            (userAttrs.totalViews || 0) >= 100 &&
            !userAttrs.raftaarFilmsApproved &&
            !userAttrs.raftaarFilmsMilestoneNotified
          ) {
            await docClient.send(
              new UpdateCommand({
                TableName: "InPlayer-Users",
                Key: { userId: uploaderId },
                UpdateExpression: "SET raftaarFilmsMilestoneNotified = :true",
                ExpressionAttributeValues: { ":true": true },
              })
            );
            const { createNotification } = await import("@/app/lib/notifications");
            await createNotification({
              userId: uploaderId,
              type: "film_milestone_100_views",
              message: "🎉 You've reached 100 total views! You are now eligible to apply and upload Raftaar Films.",
            });
          }
        } catch (milestoneErr) {
          console.error("Milestone view check error (non-fatal):", milestoneErr);
        }
      }
    }
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

  return NextResponse.json({ ok: true, views: finalViews });
}
