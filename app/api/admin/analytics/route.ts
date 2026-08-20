import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { getTrendingToday } from "@/app/lib/trendingStore";

// Real, platform-wide numbers — built on the exact same tables the rest of
// the app already writes real data to (InPlayer-Videos.views,
// InPlayer-Likes, InPlayer-Comments, InPlayer-Subscriptions,
// InPlayer-Video-Daily-Views), not a separate analytics pipeline. Until
// there's real traffic, these are honestly all zero — that's a true empty
// state, not a broken one.

const TREND_DAYS = 7;

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function countTable(tableName: string, filterExpression?: string, values?: Record<string, unknown>): Promise<number> {
  let count = 0;
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        Select: "COUNT",
        ...(filterExpression ? { FilterExpression: filterExpression } : {}),
        ...(values ? { ExpressionAttributeValues: values } : {}),
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    count += result.Count || 0;
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return count;
}

async function platformViewsOnDay(date: string): Promise<number> {
  let total = 0;
  let exclusiveStartKey: Record<string, unknown> | undefined;
  try {
    do {
      const result = await docClient.send(
        new QueryCommand({
          TableName: "InPlayer-Video-Daily-Views",
          KeyConditionExpression: "#d = :d",
          ExpressionAttributeNames: { "#d": "date" },
          ExpressionAttributeValues: { ":d": date },
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      for (const item of result.Items || []) {
        total += (item.views as number) || 0;
      }
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
  } catch (err) {
    console.error(`admin/analytics: daily views query failed for ${date}:`, err);
  }
  return total;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Videos/Shorts counts + lifetime view/share totals come from one real
  // Scan of InPlayer-Videos (small projection — fine at today's scale,
  // same tradeoff app/lib/videoStore.ts already makes).
  let totalVideos = 0;
  let totalShorts = 0;
  // Audio-only uploads, broken out on their own — same split, and for the
  // same reason, as app/api/admin/dashboard-stats/route.ts.
  let totalMusic = 0;
  let lifetimeViews = 0;
  let lifetimeMusicViews = 0;
  let lifetimeShares = 0;
  try {
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: "InPlayer-Videos",
          ProjectionExpression: "contentType, #v, shareCount",
          ExpressionAttributeNames: { "#v": "views" },
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      for (const item of result.Items || []) {
        const itemViews = (item.views as number) || 0;
        if (item.contentType === "short") {
          totalShorts += 1;
        } else if (item.contentType === "music") {
          totalMusic += 1;
          lifetimeMusicViews += itemViews;
        } else {
          totalVideos += 1;
        }
        lifetimeViews += itemViews;
        lifetimeShares += (item.shareCount as number) || 0;
      }
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
  } catch (err) {
    console.error("admin/analytics: videos scan failed:", err);
  }

  const [totalUsers, totalLikes, totalComments, totalSubscriptions, topToday] = await Promise.all(
    [
      countTable("InPlayer-Users"),
      countTable("InPlayer-Likes", "reaction = :like", { ":like": "like" }),
      countTable("InPlayer-Comments"),
      countTable("InPlayer-Subscriptions"),
      getTrendingToday(10).catch((err) => {
        console.error("admin/analytics: trending lookup failed:", err);
        return [];
      }),
    ]
  );

  const dayKeys = Array.from({ length: TREND_DAYS }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (TREND_DAYS - 1 - i));
    return dateKey(d);
  });
  const dailyTotals = await Promise.all(dayKeys.map(platformViewsOnDay));
  const viewsTrend = dayKeys.map((date, i) => ({ date, views: dailyTotals[i] }));

  return NextResponse.json({
    totals: {
      totalUsers,
      totalVideos,
      totalShorts,
      totalMusic,
      lifetimeViews,
      lifetimeMusicViews,
      lifetimeShares,
      totalLikes,
      totalComments,
      totalSubscriptions,
    },
    viewsTrend,
    topToday,
  });
}
