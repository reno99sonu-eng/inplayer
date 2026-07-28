import { NextRequest, NextResponse } from "next/server";
import { QueryCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

// New table (not yet created in AWS as of this change — see delivery
// notes): partition key userId (String), sort key playlistId (String).
// One row per playlist; `videoIds` is a DynamoDB String Set holding the
// videos it contains (the attribute is simply absent while empty —
// DynamoDB doesn't allow empty sets, so callers must treat a missing
// videoIds as []).
//
// Every viewer also has one reserved row, playlistId "saved", created the
// first time they tap the quick "Save" action on a video (see the
// quick-save branch below). It lives in the same table so quick-Save and
// Save-to-playlist share one real backend — it's just excluded from the
// "your playlists" picker so it never shows up twice or collides with a
// playlist someone names "Saved" themselves.
const PLAYLISTS_TABLE = "InPlayer-Playlists";
const SAVED_PLAYLIST_ID = "saved";

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
        TableName: PLAYLISTS_TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": user.userId },
      })
    );

    const playlists = (result.Items || []).map((item) => ({
      playlistId: item.playlistId as string,
      name: item.name as string,
      videoIds: item.videoIds ? Array.from(item.videoIds as Iterable<string>) : [],
      reserved: item.playlistId === SAVED_PLAYLIST_ID,
      createdAt: item.createdAt as string | undefined,
    }));

    return NextResponse.json({ playlists });
  } catch (err) {
    // Table not created yet, or a transient AWS error — an empty list is
    // the honest, safe fallback (never fabricated placeholder entries).
    console.error("Failed to load playlists (table may not exist yet):", err);
    return NextResponse.json({ playlists: [] });
  }
}

export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  try {
    // Creates a new, empty named playlist. The picker immediately follows
    // this with a "toggle" call (below) to add the current video — kept as
    // two calls instead of one so an empty set is never written.
    if (action === "create") {
      const name = (body.name || "").trim().slice(0, 80);
      if (!name) {
        return NextResponse.json({ error: "Playlist name is required." }, { status: 400 });
      }

      const playlistId = randomUUID();

      await docClient.send(
        new PutCommand({
          TableName: PLAYLISTS_TABLE,
          Item: {
            userId: user.userId,
            playlistId,
            name,
            createdAt: new Date().toISOString(),
          },
        })
      );

      return NextResponse.json({ playlistId, name });
    }

    // Adds/removes a video from a playlist ("toggle") or from the viewer's
    // own reserved "Saved" shelf ("quick-save") — both are the same atomic
    // ADD/DELETE-on-a-Set operation, just targeting a different row.
    if (action === "toggle" || action === "quick-save") {
      const { videoId, member } = body;
      const playlistId = action === "quick-save" ? SAVED_PLAYLIST_ID : body.playlistId;

      if (!videoId || !playlistId) {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
      }

      if (member) {
        // Upsert: the first call for a given playlistId creates the row
        // (with its name) via if_not_exists, every call after that just
        // adds to the set — one atomic request either way, no
        // read-then-write race between two tabs/devices.
        await docClient.send(
          new UpdateCommand({
            TableName: PLAYLISTS_TABLE,
            Key: { userId: user.userId, playlistId },
            UpdateExpression:
              "SET #name = if_not_exists(#name, :name), createdAt = if_not_exists(createdAt, :now) ADD videoIds :video",
            ExpressionAttributeNames: { "#name": "name" },
            ExpressionAttributeValues: {
              ":name": action === "quick-save" ? "Saved" : (body.name || "Playlist"),
              ":now": new Date().toISOString(),
              ":video": new Set([videoId]),
            },
          })
        );
      } else {
        await docClient.send(
          new UpdateCommand({
            TableName: PLAYLISTS_TABLE,
            Key: { userId: user.userId, playlistId },
            UpdateExpression: "DELETE videoIds :video",
            ExpressionAttributeValues: { ":video": new Set([videoId]) },
          })
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("Playlists table request failed (table may not exist yet):", err);
    return NextResponse.json(
      { error: "Couldn't save that right now. Please try again." },
      { status: 500 }
    );
  }
}
