import { NextRequest, NextResponse } from "next/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { getMuxThumbnailUrl } from "@/app/lib/muxThumbnail";

const PAGE_SIZE = 25;
// How many raw table items a title search is willing to walk through before
// giving up — DynamoDB has no case-insensitive contains(), so a search
// scans title in memory (same tradeoff app/lib/userSearch.ts already makes
// on a smaller table). This caps the cost of that at InPlayer's current
// scale; it would need a real search index (OpenSearch, etc.) well before
// the library gets anywhere near this many items.
const SEARCH_SCAN_CAP = 1000;

export interface AdminVideoRow {
  videoId: string;
  title: string;
  contentType: "video" | "short";
  status: string | null;
  visibility: string | null;
  views: number;
  uploaderId: string | null;
  uploaderName: string | null;
  thumbnailUrl: string | null;
  uploadedAt: string | null;
}

const PROJECTION =
  "videoId, title, contentType, #st, visibility, #v, uploaderId, uploaderName, thumbnailUrl, muxPlaybackId, uploadedAt";
const NAMES = { "#st": "status", "#v": "views" };

function toRow(item: Record<string, unknown>): AdminVideoRow {
  const thumbnailUrl =
    (item.thumbnailUrl as string) ||
    (typeof item.muxPlaybackId === "string" ? getMuxThumbnailUrl(item.muxPlaybackId) : null);

  return {
    videoId: item.videoId as string,
    title: (item.title as string) || "Untitled",
    contentType: item.contentType === "short" ? "short" : "video",
    status: (item.status as string) || null,
    visibility: (item.visibility as string) || null,
    views: (item.views as number) || 0,
    uploaderId: (item.uploaderId as string) || null,
    uploaderName: (item.uploaderName as string) || null,
    thumbnailUrl,
    uploadedAt: (item.uploadedAt as string) || null,
  };
}

function typeFilter(type: string | null) {
  if (type === "video" || type === "short") {
    return {
      FilterExpression: "contentType = :type",
      ExpressionAttributeValues: { ":type": type },
    };
  }
  return null;
}

// Title search: bounded, in-memory, case-insensitive — see SEARCH_SCAN_CAP.
async function searchVideos(query: string, type: string | null): Promise<AdminVideoRow[]> {
  const q = query.toLowerCase();
  const tf = typeFilter(type);
  const matches: AdminVideoRow[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  let scanned = 0;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        ProjectionExpression: PROJECTION,
        ExpressionAttributeNames: NAMES,
        ...(tf
          ? {
              FilterExpression: tf.FilterExpression,
              ExpressionAttributeValues: tf.ExpressionAttributeValues,
            }
          : {}),
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    for (const item of result.Items || []) {
      scanned++;
      const title = (item.title as string) || "";
      if (title.toLowerCase().includes(q)) {
        matches.push(toRow(item as Record<string, unknown>));
      }
    }

    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey && scanned < SEARCH_SCAN_CAP && matches.length < PAGE_SIZE);

  return matches.slice(0, PAGE_SIZE);
}

async function listVideos(
  type: string | null,
  cursor: string | null
): Promise<{ rows: AdminVideoRow[]; nextCursor: string | null }> {
  let exclusiveStartKey: Record<string, unknown> | undefined;
  if (cursor) {
    try {
      exclusiveStartKey = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    } catch {
      exclusiveStartKey = undefined;
    }
  }

  const tf = typeFilter(type);
  const result = await docClient.send(
    new ScanCommand({
      TableName: "InPlayer-Videos",
      ProjectionExpression: PROJECTION,
      ExpressionAttributeNames: NAMES,
      ...(tf
        ? {
            FilterExpression: tf.FilterExpression,
            ExpressionAttributeValues: tf.ExpressionAttributeValues,
          }
        : {}),
      Limit: PAGE_SIZE,
      ExclusiveStartKey: exclusiveStartKey,
    })
  );

  const rows = (result.Items || []).map(toRow);
  const nextCursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
    : null;

  return { rows, nextCursor };
}

// Admin content browser: unlike app/lib/videoStore.ts (which only ever
// surfaces ready + public content for real visitors), this deliberately
// scans EVERY status and EVERY visibility — processing uploads, errored
// ones, unlisted/private ones — because moderation needs to see all of it,
// not just what the public site shows.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type");
  const query = request.nextUrl.searchParams.get("query")?.trim() || "";
  const cursor = request.nextUrl.searchParams.get("cursor");

  try {
    if (query) {
      const rows = await searchVideos(query, type);
      return NextResponse.json({ videos: rows, nextCursor: null });
    }

    const { rows, nextCursor } = await listVideos(type, cursor);
    return NextResponse.json({ videos: rows, nextCursor });
  } catch (err) {
    console.error("Admin videos list failed:", err);
    return NextResponse.json({ error: "Couldn't load content right now." }, { status: 500 });
  }
}
