import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { isAdminEmail } from "@/app/lib/isAdmin";
import { revalidateTag } from "next/cache";
import { READY_VIDEOS_TAG } from "@/app/lib/videoStore";

// Same two ways in as app/api/admin/self-heal-videos — a signed-in admin, or
// a matching x-admin-key header for curl/automation.
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

// One-time repair for tracks uploaded before contentType:"music" existed as
// a concept (see app/lib/contentTypes.ts) — every one of them was saved
// with category:"Music" but contentType defaulting to "video", because that
// field simply didn't exist yet at the time. The strict isolation the
// Music page/player now rely on (contentType === "music", never inferred
// from category) correctly excludes those legacy rows, which is why they
// vanished from Music surfaces on both web and the app even though the
// filter logic itself is working exactly as designed. This backfill finds
// every such row and sets contentType:"music" once, after which they're
// indistinguishable from tracks uploaded through the current music flow.
async function scanLegacyMusicVideos(): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        FilterExpression: "category = :music AND (attribute_not_exists(contentType) OR contentType <> :musicType)",
        ExpressionAttributeValues: { ":music": "Music", ":musicType": "music" },
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    items.push(...(result.Items || []));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const legacyItems = await scanLegacyMusicVideos();

  let healed = 0;
  const errors: string[] = [];

  for (const item of legacyItems) {
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId: item.videoId },
          UpdateExpression: "SET contentType = :musicType",
          ExpressionAttributeValues: { ":musicType": "music" },
        })
      );
      healed++;
    } catch (err) {
      errors.push(`${item.videoId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (healed > 0) {
    revalidateTag(READY_VIDEOS_TAG, "max");
  }

  return NextResponse.json({
    done: true,
    totalFound: legacyItems.length,
    healed,
    errors,
  });
}
