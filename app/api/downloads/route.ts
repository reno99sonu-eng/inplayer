import { NextRequest, NextResponse } from "next/server";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

// New table (not yet created in AWS as of this change — see delivery
// notes): partition key userId, sort key videoId. One row per
// (user, video) pair — downloading the same video again just refreshes
// its row instead of piling up duplicates, same idea as Watchlist/History.
const DOWNLOADS_TABLE = "InPlayer-Downloads";

export async function GET(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: DOWNLOADS_TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": user.userId },
      })
    );

    const downloads = (result.Items || []).sort(
      (a, b) =>
        new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime()
    );

    return NextResponse.json({ downloads });
  } catch (err) {
    // Table not created yet, or a transient AWS error — an empty list is
    // the honest, safe fallback (never fabricated placeholder entries).
    console.error("Failed to load downloads (table may not exist yet):", err);
    return NextResponse.json({ downloads: [] });
  }
}

// action: "record" fires from DownloadButton the moment a real download
// starts (mirrors ShareButton's recordShare, fire-and-forget, never blocks
// the actual file download). action: "remove" is the Downloads screen's
// own "remove from my library" control — same {videoId, action} shape as
// /api/watchlist for consistency with the rest of the app.
export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { videoId, quality, action } = await request.json();

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

  try {
    if (action === "remove") {
      await docClient.send(
        new DeleteCommand({
          TableName: DOWNLOADS_TABLE,
          Key: { userId: user.userId, videoId },
        })
      );
      return NextResponse.json({ success: true });
    }

    // Denormalize the video's display info so the Downloads screen can
    // render without a second lookup per item (same pattern as History /
    // Watchlist).
    const videoResult = await docClient.send(
      new GetCommand({ TableName: "InPlayer-Videos", Key: { videoId } })
    );
    const video = videoResult.Item;

    await docClient.send(
      new PutCommand({
        TableName: DOWNLOADS_TABLE,
        Item: {
          userId: user.userId,
          videoId,
          title: video?.title || "Unknown video",
          thumbnailUrl: video?.thumbnailUrl || "",
          uploaderName: video?.uploaderName || "",
          quality: quality || "default",
          downloadedAt: new Date().toISOString(),
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Downloads table request failed (table may not exist yet):", err);
    // Still 200 for "record" — the real download itself already succeeded
    // independently of this tally, so this failing shouldn't read as an
    // error to anyone. "remove" surfaces the failure since the user is
    // actively waiting on it.
    if (action === "remove") {
      return NextResponse.json({ error: "Couldn't remove it. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ success: false });
  }
}
