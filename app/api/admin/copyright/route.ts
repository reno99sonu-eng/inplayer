import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { logAdminAction } from "@/app/lib/auditLog";
import { deleteVideoCascade } from "@/app/lib/cascadeDelete";
import {
  COPYRIGHT_SCREEN_REPORTER,
  externalCheckingEnabled,
} from "@/app/lib/musicCopyright";

// Real copyright strikes system, layered on top of the existing
// InPlayer-Reports queue (reason: "copyright") rather than a separate
// table — a copyright report already carries everything this needs
// (videoId, reporterId, details). Scoped to video reports only for V1:
// a strikes-against-an-uploader system doesn't map cleanly onto comment
// or message reports, which InPlayer-Reports also carries under the same
// "copyright" reason.
//
// copyrightStrikes lives directly on the InPlayer-Users row (a plain
// Number attribute, incremented with an atomic ADD — no separate strikes
// table, same "small admin-only counter" reasoning as everything else
// this table stores). Reaching STRIKE_THRESHOLD auto-suspends the account
// the exact same way the Users page's manual suspend does (isSuspended:
// true), which app/lib/verifyAuth.ts already enforces on every request.
const REPORTS_TABLE = "InPlayer-Reports";
const USERS_TABLE = "InPlayer-Users";
export const STRIKE_THRESHOLD = 3;

async function scanAll(
  filterExpression: string,
  values: Record<string, unknown>,
  names?: Record<string, string>
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: REPORTS_TABLE,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: values,
        ...(names ? { ExpressionAttributeNames: names } : {}),
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    items.push(...((result.Items || []) as Record<string, unknown>[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const reports = await scanAll(
      "reason = :r AND targetType = :t AND #s = :open",
      { ":r": "copyright", ":t": "video", ":open": "open" },
      { "#s": "status" }
    );

    const sorted = reports.sort(
      (a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
    );

    const items = await Promise.all(
      sorted.map(async (r) => {
        const videoId = r.videoId as string;
        let title = "(video not found)";
        let uploaderId: string | null = null;
        let uploaderUsername: string | null = null;
        let currentStrikes = 0;

        try {
          const video = await docClient.send(
            new GetCommand({
              TableName: "InPlayer-Videos",
              Key: { videoId },
              ProjectionExpression: "title, uploaderId",
            })
          );
          if (video.Item) {
            title = (video.Item.title as string) || "Untitled";
            uploaderId = (video.Item.uploaderId as string) || null;
          }
        } catch {
          /* video gone — report still shown, just without a title */
        }

        if (uploaderId) {
          try {
            const uploader = await docClient.send(
              new GetCommand({
                TableName: USERS_TABLE,
                Key: { userId: uploaderId },
                ProjectionExpression: "username, copyrightStrikes, isSuspended",
              })
            );
            uploaderUsername = (uploader.Item?.username as string) || null;
            currentStrikes = (uploader.Item?.copyrightStrikes as number) || 0;
          } catch {
            /* uploader lookup best-effort */
          }
        }

        return {
          reportId: r.reportId as string,
          videoId,
          title,
          uploaderId,
          uploaderUsername,
          reporterId: r.reporterId as string,
          details: (r.details as string) || "",
          createdAt: r.createdAt as string,
          currentStrikes,
          // Raised by the upload screening rather than by a person. A
          // reviewer has to be able to see the difference before issuing a
          // strike: nobody has actually claimed this recording yet, the
          // wording just looked like a re-upload. See
          // COPYRIGHT_SCREEN_REPORTER.
          autoFlagged: r.reporterId === COPYRIGHT_SCREEN_REPORTER,
        };
      })
    );

    return NextResponse.json({
      items,
      strikeThreshold: STRIKE_THRESHOLD,
      // Whether audio fingerprinting against commercial catalogues is
      // actually switched on. Surfaced so a reviewer knows whether "no
      // external match" means "checked and clean" or "never checked" —
      // conflating those is how someone ends up trusting a check that
      // never ran. See app/lib/musicCopyright.ts.
      externalFingerprinting: externalCheckingEnabled(),
    });
  } catch (err) {
    console.error("Copyright queue scan failed (table may not exist yet):", err);
    return NextResponse.json({ items: [], strikeThreshold: STRIKE_THRESHOLD, tableMissing: true });
  }
}

export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const reportId = body?.reportId;
  const action = body?.action;
  const removeVideo = Boolean(body?.removeVideo);

  if (!reportId || (action !== "strike" && action !== "dismiss")) {
    return NextResponse.json({ error: "reportId and a valid action are required." }, { status: 400 });
  }

  const reportResult = await docClient.send(
    new GetCommand({ TableName: REPORTS_TABLE, Key: { reportId } })
  );
  const report = reportResult.Item;
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  if (action === "dismiss") {
    await docClient.send(
      new UpdateCommand({
        TableName: REPORTS_TABLE,
        Key: { reportId },
        UpdateExpression: "SET #s = :s, reviewedAt = :r",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": "resolved", ":r": new Date().toISOString() },
      })
    );

    await logAdminAction({
      request,
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "copyright.dismiss",
      targetType: "report",
      targetId: reportId,
    });

    return NextResponse.json({ success: true });
  }

  // action === "strike"
  const videoId = report.videoId as string | undefined;
  let uploaderId: string | null = null;
  if (videoId) {
    try {
      const video = await docClient.send(
        new GetCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId },
          ProjectionExpression: "uploaderId",
        })
      );
      uploaderId = (video.Item?.uploaderId as string) || null;
    } catch {
      /* video may already be gone */
    }
  }

  if (!uploaderId) {
    return NextResponse.json(
      { error: "Couldn't find the uploader to strike — the video may already be gone." },
      { status: 400 }
    );
  }

  const updated = await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId: uploaderId },
      UpdateExpression: "ADD copyrightStrikes :one",
      ExpressionAttributeValues: { ":one": 1 },
      ReturnValues: "UPDATED_NEW",
    })
  );
  const newStrikeCount = (updated.Attributes?.copyrightStrikes as number) || 1;

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "copyright.strike",
    targetType: "user",
    targetId: uploaderId,
    details: `Strike ${newStrikeCount}/${STRIKE_THRESHOLD} — report ${reportId}${videoId ? `, video ${videoId}` : ""}`,
  });

  let autoSuspended = false;
  if (newStrikeCount >= STRIKE_THRESHOLD) {
    await docClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId: uploaderId },
        UpdateExpression: "SET isSuspended = :s, updatedAt = :u",
        ExpressionAttributeValues: { ":s": true, ":u": new Date().toISOString() },
      })
    );
    autoSuspended = true;

    await logAdminAction({
      request,
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "copyright.autosuspend",
      targetType: "user",
      targetId: uploaderId,
      details: `Reached ${newStrikeCount} copyright strikes`,
    });
  }

  if (removeVideo && videoId) {
    const cascade = await deleteVideoCascade(videoId);
    if (!cascade.success) {
      console.error(`copyright strike: video ${videoId} cascade delete had warnings:`, cascade.errors);
    }
  }

  await docClient.send(
    new UpdateCommand({
      TableName: REPORTS_TABLE,
      Key: { reportId },
      UpdateExpression: "SET #s = :s, reviewedAt = :r",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": "resolved", ":r": new Date().toISOString() },
    })
  );

  return NextResponse.json({ success: true, newStrikeCount, autoSuspended });
}
