import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { isAdminEmail } from "@/app/lib/isAdmin";
import { getMuxThumbnailUrl } from "@/app/lib/muxThumbnail";

// Same two ways in as app/api/admin/recaption — a signed-in admin (what the
// in-app "Fix Shorts thumbnails" button on app/admin/captions uses) or a
// matching x-admin-key header for curl/automation.
async function isAuthorized(request: NextRequest): Promise<boolean> {
  const expectedKey = process.env.ADMIN_MAINTENANCE_KEY;
  const providedKey = request.headers.get("x-admin-key");
  if (expectedKey && providedKey === expectedKey) return true;

  try {
    const user = await verifyAuth(request);
    if (isAdminEmail(user.email)) return true;
  } catch {
    // Not a valid signed-in request — fall through to unauthorized.
  }
  return false;
}

// One-time maintenance endpoint: fixes the thumbnailUrl already stored for
// every ALREADY-PUBLISHED Short. The webhook fix (app/api/webhooks/mux) only
// changes NEW uploads going forward — Shorts processed before that fix have
// a landscape-shaped (640x360) Mux thumbnail URL permanently saved on their
// row, which is what was actually showing as "stretched" on the homepage.
// Mux thumbnails are generated on demand from the URL's own query
// parameters, so simply overwriting the stored URL with the correct
// portrait-shaped one (no re-upload, no asset changes) is enough — Mux
// serves a fresh, properly-cropped image the next time that URL loads.
//
// Skips anything with a customThumbnailUrl set — a creator's own uploaded
// thumbnail is never touched, same "creator choice always wins" rule the
// live thumbnailUrl field already follows (see the webhook's
// if_not_exists(customThumbnailUrl, ...) update). Safe to re-run: already
// -fixed rows are simply skipped again.
async function scanAllVideos(): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    items.push(...((result.Items || []) as Record<string, unknown>[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allItems = await scanAllVideos();

  let processed = 0;
  let skippedCustomThumbnail = 0;
  let skippedNoPlaybackId = 0;
  const errors: string[] = [];

  for (const item of allItems) {
    if (item.contentType !== "short") continue;

    const videoId = item.videoId as string | undefined;
    const playbackId = item.muxPlaybackId as string | undefined;
    if (!videoId) continue;

    if (item.customThumbnailUrl) {
      skippedCustomThumbnail++;
      continue;
    }
    if (!playbackId) {
      skippedNoPlaybackId++;
      continue;
    }

    try {
      const portraitThumbnailUrl = getMuxThumbnailUrl(playbackId, true);
      if (!portraitThumbnailUrl) continue;

      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId },
          UpdateExpression: "SET thumbnailUrl = :thumbnailUrl",
          ExpressionAttributeValues: { ":thumbnailUrl": portraitThumbnailUrl },
        })
      );
      processed++;
    } catch (err) {
      errors.push(`${videoId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    done: true,
    processed,
    skippedCustomThumbnail,
    skippedNoPlaybackId,
    errors,
  });
}
