import { NextRequest, NextResponse } from "next/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";

// Real counts for the Admin Dashboard's top KPI cards — every number here
// comes straight from DynamoDB, computed fresh on each load. No estimates,
// no placeholders. Uses a narrow ProjectionExpression on each Scan so this
// stays cheap even as the tables grow (only the few attributes actually
// needed are pulled back, not full items).
async function scanAll(
  tableName: string,
  projectionExpression: string,
  expressionAttributeNames?: Record<string, string>
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ProjectionExpression: projectionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
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

  let totalUsers = 0;
  try {
    const users = await scanAll("InPlayer-Users", "userId");
    totalUsers = users.length;
  } catch (err) {
    console.error("Dashboard stats: users scan failed:", err);
  }

  let totalVideos = 0;
  let totalShorts = 0;
  // Music is counted SEPARATELY from totalVideos, not inside it. These two
  // cards link to /admin/videos?type=video and ?type=music, which are now
  // genuinely disjoint lists, and the rule this file already documents is
  // that a card's number must match the list it opens.
  //
  // Note this differs on purpose from app/lib/monetization.ts, where music
  // plays DO count inside videoViews: there the number decides whether a
  // creator crosses the 50k threshold, and a musician's work must count
  // toward it. Here the number is a row count next to a filtered list.
  let totalMusic = 0;
  let totalViews = 0;
  let musicViews = 0;
  let processingCount = 0;
  try {
    const items = await scanAll(
      "InPlayer-Videos",
      "contentType, #st, #v",
      { "#st": "status", "#v": "views" }
    );
    // Status buckets have to match what /admin/videos actually filters on
    // (STATUS_VALUES there: live | processing | ready | error), because
    // these Dashboard cards LINK straight to that page.
    //
    // This previously read `if (status && status !== "ready") {
    // processingCount++; continue; }`, which was wrong twice over:
    //   - live streams and failed uploads were both counted as "Processing
    //     Uploads", so that card's number never matched the list it links
    //     to (/admin/videos?status=processing);
    //   - and because of the `continue`, those same items were excluded
    //     from Total Videos / Total Shorts / Total Views, so "Total Videos"
    //     undercounted against /admin/videos?type=video.
    //
    // A missing status field means "ready" — it predates the attribute,
    // the same equivalence app/api/admin/videos/route.ts's filter makes.
    for (const item of items) {
      const status = (item.status as string | undefined) || "ready";

      if (status === "processing") {
        processingCount++;
        continue;
      }

      // An errored upload never became real content — no playable asset,
      // no views — so it belongs in neither the totals nor the processing
      // count.
      if (status === "error") continue;

      // "ready" and "live" are both real, watchable content; a live stream
      // accrues views like anything else.
      const itemViews = (item.views as number) || 0;
      if (item.contentType === "short") {
        totalShorts++;
      } else if (item.contentType === "music") {
        totalMusic++;
        musicViews += itemViews;
      } else {
        // Includes rows with no contentType at all — pre-dating the field,
        // and matched by the Videos tab's attribute_not_exists clause.
        totalVideos++;
      }
      totalViews += itemViews;
    }
  } catch (err) {
    console.error("Dashboard stats: videos scan failed:", err);
  }

  // InPlayer-Reports is a newer table (added alongside the Report button) —
  // stay honest if it hasn't been created in AWS yet rather than silently
  // showing 0 as if there were zero reports.
  let pendingReports = 0;
  let reportsTableMissing = false;
  try {
    const reports = await scanAll("InPlayer-Reports", "reportId, #st", {
      "#st": "status",
    });
    pendingReports = reports.filter((r) => r.status === "open").length;
  } catch (err) {
    console.error(
      "Dashboard stats: reports scan failed (table may not exist yet):",
      err
    );
    reportsTableMissing = true;
  }

  return NextResponse.json({
    totalUsers,
    totalVideos,
    totalShorts,
    totalMusic,
    totalViews,
    musicViews,
    processingCount,
    pendingReports,
    reportsTableMissing,
  });
}
