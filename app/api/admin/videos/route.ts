import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
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
    (typeof item.muxPlaybackId === "string"
      ? getMuxThumbnailUrl(item.muxPlaybackId, item.contentType === "short")
      : null);

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

// Real status values ever written to a video item's `status` field (see
// app/api/upload/create, app/api/live/ivs-create, app/api/live/end, and the
// Mux/IVS-recording webhooks): "ready" once playable, "processing" while
// Mux (or, for a livestream, the live-to-VOD pipeline) is still working on
// it, "live" for a stream currently broadcasting, and "error" if it failed.
// A video with no status field at all predates the `status` attribute being
// introduced and is treated the same as "ready" everywhere else in this
// codebase (see e.g. app/lib/selfHealVideo.ts's `!== "processing"` checks) —
// STATUS_VALUES lists every value the filter UI offers; "ready" additionally
// matches "no status field" via the ConditionalStatus filter below.
export const STATUS_VALUES = ["live", "processing", "ready", "error"] as const;
export type VideoStatusFilter = (typeof STATUS_VALUES)[number];

function isStatusFilter(value: string | null): value is VideoStatusFilter {
  return !!value && (STATUS_VALUES as readonly string[]).includes(value);
}

// Combines the optional contentType (type=video|short) and status filters
// into one FilterExpression — DynamoDB only allows one per Scan/Query, so
// both dimensions have to be ANDed together here rather than applied
// separately. "ready" is the one status that also has to match items with
// no status attribute at all (every video uploaded before the status field
// existed), which is why it gets its own OR clause instead of a plain
// equality check. Uses "#st" for the status attribute name without
// declaring it itself — every call site below already passes the shared
// NAMES constant (which maps "#st" -> "status") alongside this filter, so
// there's nothing to merge.
function buildFilter(type: string | null, status: string | null) {
  const clauses: string[] = [];
  const values: Record<string, unknown> = {};

  if (type === "video" || type === "short") {
    clauses.push("contentType = :type");
    values[":type"] = type;
  }

  if (isStatusFilter(status)) {
    if (status === "ready") {
      clauses.push("(attribute_not_exists(#st) OR #st = :statusReady)");
      values[":statusReady"] = "ready";
    } else {
      clauses.push("#st = :status");
      values[":status"] = status;
    }
  }

  if (clauses.length === 0) return null;
  return {
    FilterExpression: clauses.join(" AND "),
    ExpressionAttributeValues: values,
  };
}

// Real counts per status tab, respecting the active type filter (so "Shorts"
// + "Processing" shows how many Shorts specifically are processing, not the
// site-wide total) — same "actually scan for a real number" convention
// dashboard-stats and the Hammart admin pages already use, just narrowed to
// a 2-attribute projection so it stays cheap even as the table grows.
async function computeStatusCounts(type: string | null): Promise<Record<string, number>> {
  const counts: Record<string, number> = { live: 0, processing: 0, ready: 0, error: 0 };
  const tf = type === "video" || type === "short"
    ? { FilterExpression: "contentType = :type", ExpressionAttributeValues: { ":type": type } }
    : null;

  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        ProjectionExpression: "contentType, #st",
        ExpressionAttributeNames: { "#st": "status" },
        ...(tf
          ? { FilterExpression: tf.FilterExpression, ExpressionAttributeValues: tf.ExpressionAttributeValues }
          : {}),
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    for (const item of result.Items || []) {
      const status = (item.status as string) || "ready";
      if (status in counts) counts[status]++;
      else counts.ready++;
    }

    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return counts;
}

// Exact videoId match — a cheap, direct GetCommand tried first so pasting
// a real videoId (e.g. copied from a /watch URL, Copyright Center, or the
// Moderation queue) always finds it, even though the title search below
// has no way to match on ID.
async function findVideoById(rawQuery: string): Promise<AdminVideoRow | null> {
  const trimmed = rawQuery.trim();
  if (!trimmed) return null;
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId: trimmed },
        ProjectionExpression: PROJECTION,
        ExpressionAttributeNames: NAMES,
      })
    );
    return result.Item ? toRow(result.Item as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Title search: bounded, in-memory, case-insensitive — see SEARCH_SCAN_CAP.
async function searchVideos(query: string, type: string | null, status: string | null): Promise<AdminVideoRow[]> {
  const byId = await findVideoById(query);

  const q = query.toLowerCase();
  const tf = buildFilter(type, status);
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

  // An exact-ID match respects the active type AND status filters (searching
  // within "Shorts" + "Processing" for a videoId that turns out to be a
  // ready regular video shouldn't surface it there), and is deduped against
  // the title-match list.
  const byIdStatus = byId?.status || "ready";
  const idMatchApplies =
    byId &&
    (!type || byId.contentType === type) &&
    (!isStatusFilter(status) || byIdStatus === status) &&
    !matches.some((m) => m.videoId === byId.videoId);

  const titleMatches = matches.slice(0, idMatchApplies ? PAGE_SIZE - 1 : PAGE_SIZE);
  return idMatchApplies ? [byId as AdminVideoRow, ...titleMatches] : titleMatches;
}

async function listVideos(
  type: string | null,
  status: string | null,
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

  const tf = buildFilter(type, status);
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
  const status = request.nextUrl.searchParams.get("status");
  const query = request.nextUrl.searchParams.get("query")?.trim() || "";
  const cursor = request.nextUrl.searchParams.get("cursor");
  // Skipped whenever a search query is active — the search path already
  // walks the whole (capped) table itself, so a second full-table counts
  // scan on every keystroke would double the DynamoDB cost of every search
  // for a number the search results UI doesn't even need.
  const includeCounts = !query && !cursor;

  try {
    if (query) {
      const rows = await searchVideos(query, type, status);
      return NextResponse.json({ videos: rows, nextCursor: null });
    }

    const [{ rows, nextCursor }, counts] = await Promise.all([
      listVideos(type, status, cursor),
      includeCounts ? computeStatusCounts(type) : Promise.resolve(undefined),
    ]);
    return NextResponse.json({ videos: rows, nextCursor, ...(counts ? { counts } : {}) });
  } catch (err) {
    console.error("Admin videos list failed:", err);
    return NextResponse.json({ error: "Couldn't load content right now." }, { status: 500 });
  }
}
