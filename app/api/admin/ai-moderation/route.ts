import { NextRequest, NextResponse } from "next/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { PRODUCTS_TABLE } from "@/app/lib/hammartProducts";

// Real observability for the two SEPARATE automatic moderation pipelines —
// app/lib/moderation.ts's moderateText() for InPlayer content (comments,
// messages, uploads) and app/lib/hammartModeration.ts's checkBannedProduct()
// for Hammart listings. These were always functionally independent
// checks against different tables, but this route used to only ever
// report the InPlayer side and Hammart's had no on/off toggle at all — this
// now branches on ?domain=hammart so Admin Panel > AI Moderation (now
// reachable from both the InPlayer and Hammart panels, see AdminSidebar)
// shows each panel's own real counts and its own toggle. No separate
// moderation-log table for either — "flagged: true" on the item itself IS
// the record.

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

// Same idea as scanFlagged above, but Hammart products store a single
// flaggedCategory string (app/lib/hammartModeration.ts's classifier only
// ever returns one category per listing), not an array — hence the
// separate, slightly different scan instead of reusing scanFlagged as-is.
async function scanFlaggedProducts(): Promise<{ count: number; categories: CategoryCounts }> {
  let count = 0;
  const categories: CategoryCounts = {};
  let exclusiveStartKey: Record<string, unknown> | undefined;
  try {
    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: PRODUCTS_TABLE,
          FilterExpression: "flagged = :true",
          ExpressionAttributeValues: { ":true": true },
          ProjectionExpression: "flagged, flaggedCategory",
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      for (const item of result.Items || []) {
        count += 1;
        const cat = item.flaggedCategory as string | null | undefined;
        if (cat) categories[cat] = (categories[cat] || 0) + 1;
      }
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
  } catch (err) {
    console.error("admin/ai-moderation: scan failed for Hammart products:", err);
  }
  return { count, categories };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const domain = request.nextUrl.searchParams.get("domain") === "hammart" ? "hammart" : "inplayer";

  if (domain === "hammart") {
    const [settings, products] = await Promise.all([getPlatformSettings(), scanFlaggedProducts()]);
    return NextResponse.json({
      domain: "hammart",
      settings: {
        hammartModerationEnabledListings: settings.hammartModerationEnabledListings,
      },
      counts: {
        listings: products.count,
      },
      categories: products.categories,
    });
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
    domain: "inplayer",
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
