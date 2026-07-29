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
  let totalViews = 0;
  let processingCount = 0;
  try {
    const items = await scanAll(
      "InPlayer-Videos",
      "contentType, #st, #v",
      { "#st": "status", "#v": "views" }
    );
    for (const item of items) {
      const status = item.status as string | undefined;
      if (status && status !== "ready") {
        processingCount++;
        continue;
      }
      if (item.contentType === "short") {
        totalShorts++;
      } else {
        totalVideos++;
      }
      totalViews += (item.views as number) || 0;
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
    totalViews,
    processingCount,
    pendingReports,
    reportsTableMissing,
  });
}
