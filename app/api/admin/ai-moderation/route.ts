import { NextRequest, NextResponse } from "next/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { getPlatformSettings } from "@/app/lib/platformSettings";

// Real observability for the automatic moderation pipeline (app/lib/
// moderation.ts) — counts what it has actually flagged and hidden so far,
// straight from the same tables the real comment/message/upload flows
// write to. No separate moderation-log table; "flagged: true" on the item
// itself IS the record.

interface CategoryCounts {
  [category: string]: number;
}

async function scanFlagged(
  tableName: string,
  projection: string
): Promise<{ count: number; categories: CategoryCounts }> {
  let count = 0;
  const categories: CategoryCounts = {};
  let exclusiveStartKey: Record<string, unknown> | undefined;
  try {
    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: tableName,
          FilterExpression: "flagged = :true",
          ExpressionAttributeValues: { ":true": true },
          ProjectionExpression: projection,
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      for (const item of result.Items || []) {
        count += 1;
        const cats = (item.flaggedCategories as string[] | undefined) || [];
        for (const c of cats) categories[c] = (categories[c] || 0) + 1;
      }
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
  } catch (err) {
    console.error(`admin/ai-moderation: scan failed for ${tableName}:`, err);
  }
  return { count, categories };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [settings, comments, messages, videosAll] = await Promise.all([
    getPlatformSettings(),
    scanFlagged("InPlayer-Comments", "flagged, flaggedCategories"),
    scanFlagged("InPlayer-Messages", "flagged, flaggedCategories"),
    scanFlagged("InPlayer-Videos", "flagged, flaggedCategories, contentType"),
  ]);

  const mergedCategories: CategoryCounts = {};
  for (const src of [comments.categories, messages.categories, videosAll.categories]) {
    for (const [cat, n] of Object.entries(src)) {
      mergedCategories[cat] = (mergedCategories[cat] || 0) + n;
    }
  }

  return NextResponse.json({
    settings: {
      moderationEnabledComments: settings.moderationEnabledComments,
      moderationEnabledMessages: settings.moderationEnabledMessages,
      moderationEnabledUploads: settings.moderationEnabledUploads,
    },
    counts: {
      comments: comments.count,
      messages: messages.count,
      uploads: videosAll.count,
    },
    categories: mergedCategories,
  });
}
