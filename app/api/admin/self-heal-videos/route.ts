import { NextRequest, NextResponse } from "next/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { isAdminEmail } from "@/app/lib/isAdmin";
import { selfHealVideoItem } from "@/app/lib/selfHealVideo";
import { revalidateTag } from "next/cache";
import { READY_VIDEOS_TAG } from "@/app/lib/videoStore";

// Same two ways in as app/api/admin/backfill-short-thumbnails — a signed-in
// admin, or a matching x-admin-key header for curl/automation.
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

// One-time repair for uploads already stuck at status:"processing" from
// before the geo-restriction middleware's gap (see middleware.ts) was
// closed — Mux and Razorpay's own servers aren't in India, so the Mux
// webhook that flips a video to "ready" was silently getting rewritten to
// /geo-blocked instead of reaching app/api/webhooks/mux, for however many
// deliveries happened to resolve to a non-"IN" x-vercel-ip-country. New
// uploads are unaffected now that /api/webhooks is exempted from the geo
// check. This endpoint rescues everything that got stuck BEFORE that fix —
// same selfHealVideoItem check app/api/my-videos and
// app/api/users/[username] already run automatically (ask Mux directly
// whether the asset actually finished, and update the row if so) — just
// run proactively across the whole table instead of waiting for an owner
// to happen to open their channel or studio page.
async function scanProcessingVideos(): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        FilterExpression: "#status = :processing",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":processing": "processing" },
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

  const stuckItems = await scanProcessingVideos();

  let healedToReady = 0;
  let healedToError = 0;
  let stillProcessing = 0;
  const errors: string[] = [];

  for (const item of stuckItems) {
    try {
      const result = await selfHealVideoItem(item);
      if (result.status === "ready") healedToReady++;
      else if (result.status === "error") healedToError++;
      else stillProcessing++;
    } catch (err) {
      errors.push(`${item.videoId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Any row just flipped to "ready" needs the shared homepage/videos/shorts
  // cache invalidated the same way the Mux webhook itself does, otherwise
  // newly-rescued videos would sit correctly in the database but stay
  // invisible on those surfaces for up to the cache's own TTL.
  if (healedToReady > 0) {
    revalidateTag(READY_VIDEOS_TAG, "max");
  }

  return NextResponse.json({
    done: true,
    totalStuck: stuckItems.length,
    healedToReady,
    healedToError,
    stillProcessing,
    errors,
  });
}
