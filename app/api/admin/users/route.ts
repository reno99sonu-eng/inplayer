import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, BatchGetCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { normalizeUsername } from "@/app/lib/username";
import { resolveCognitoEmails } from "@/app/lib/cognitoClient";

const PAGE_SIZE = 25;

export interface AdminUserRow {
  userId: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  isSuspended: boolean;
  /** ISO expiry of InPlayer Premium, or null. See app/lib/premium.ts. */
  premiumUntil: string | null;
  email: string | null;
}

function toRow(item: Record<string, unknown>): AdminUserRow {
  return {
    userId: item.userId as string,
    username: (item.username as string) || null,
    name: (item.name as string) || null,
    avatarUrl: (item.avatarUrl as string) || null,
    createdAt: (item.createdAt as string) || null,
    isSuspended: item.isSuspended === true,
    // Surfaced so an admin can see, and change, who actually has Premium —
    // previously the only way to set it was editing DynamoDB by hand.
    premiumUntil: (item.premiumUntil as string) || null,
    // Filled in afterward by attachEmails() — Cognito is the only place
    // InPlayer stores real email addresses, so this starts null and gets
    // hydrated with one ListUsers-by-sub lookup per row.
    email: null,
  };
}

// Cognito has no bulk "get many users by sub" API, so this is one real
// ListUsers call per row (run in parallel by resolveCognitoEmails) — fine
// at a PAGE_SIZE of 25. A row whose email can't be resolved (e.g. the
// Cognito account is gone) just keeps email: null rather than failing the
// whole list.
async function attachEmails(rows: AdminUserRow[]): Promise<AdminUserRow[]> {
  if (rows.length === 0) return rows;
  const emails = await resolveCognitoEmails(rows.map((r) => r.userId));
  return rows.map((r) => ({ ...r, email: emails.get(r.userId) || null }));
}

const USER_PROJECTION =
  "userId, username, #n, avatarUrl, createdAt, isSuspended, premiumUntil";
const USER_PROJECTION_NAMES = { "#n": "name" };

// Free-text search: real accounts only, matched by username (InPlayer's
// only indexed-ish lookup — see app/lib/userSearch.ts, this mirrors that
// same Scan-and-filter approach on the small InPlayer-Usernames table,
// then hydrates full rows from InPlayer-Users). Search itself still only
// matches by username, not email — InPlayer-Users doesn't store email, so
// there's no indexed way to search Cognito by partial email match. Email
// is attached afterward (see attachEmails) purely for display.
// Exact userId match — a cheap, direct GetCommand tried first so pasting
// a real userId (e.g. copied from Audit Logs, a support ticket, or the
// browser URL of a user's own profile fetch) always finds the account,
// even though InPlayer-Users has no separate "search by ID" index. Tried
// against the RAW query (a Cognito sub isn't a normalized username).
async function findUserById(rawQuery: string): Promise<AdminUserRow | null> {
  const trimmed = rawQuery.trim();
  if (!trimmed) return null;
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Users",
        Key: { userId: trimmed },
        ProjectionExpression: USER_PROJECTION,
        ExpressionAttributeNames: USER_PROJECTION_NAMES,
      })
    );
    return result.Item ? toRow(result.Item) : null;
  } catch {
    // Not a valid key shape (or the lookup otherwise failed) — not an
    // error worth surfacing, the username search below still runs.
    return null;
  }
}

async function searchUsers(query: string): Promise<AdminUserRow[]> {
  const byId = await findUserById(query);

  const q = normalizeUsername(query);
  if (!q) return byId ? [byId] : [];

  const matches: { userId: string; username: string }[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Usernames",
        FilterExpression: "contains(usernameLower, :q)",
        ExpressionAttributeValues: { ":q": q },
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    for (const item of result.Items || []) {
      matches.push({ userId: item.userId, username: item.username });
    }
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey && matches.length < PAGE_SIZE * 4);

  const top = matches
    .filter((m) => m.userId !== byId?.userId)
    .sort((a, b) => {
      const aStarts = a.username.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.username.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.username.length - b.username.length;
    })
    .slice(0, byId ? PAGE_SIZE - 1 : PAGE_SIZE);

  if (top.length === 0) return byId ? [byId] : [];

  const result = await docClient.send(
    new BatchGetCommand({
      RequestItems: {
        "InPlayer-Users": {
          Keys: top.map((u) => ({ userId: u.userId })),
          ProjectionExpression: USER_PROJECTION,
          ExpressionAttributeNames: USER_PROJECTION_NAMES,
        },
      },
    })
  );

  const usernameMatches = (result.Responses?.["InPlayer-Users"] || []).map(toRow);
  return byId ? [byId, ...usernameMatches] : usernameMatches;
}

// No query: plain browse, newest-registered-first. createdAt isn't
// indexed (no GSI), so a true DynamoDB-side sort isn't possible without
// adding one. Instead we Scan the whole table (bounded by SCAN_CAP as a
// safety limit), sort in memory by createdAt desc, and paginate the sorted
// array with a numeric offset cursor. This is the same
// scan-and-sort-in-memory tradeoff already used elsewhere in this codebase
// (see app/lib/videoStore.ts) — fine at InPlayer's current user count, but
// it re-scans the full table on every uncached page 1 request, so if the
// user base grows large enough for this to matter, replace it with a GSI
// keyed on a constant partition + createdAt range sort key.
const SCAN_CAP = 20000;
const SORTED_CACHE_TTL_MS = 30_000;
let sortedUsersCache: { rows: AdminUserRow[]; expiresAt: number } | null = null;

async function scanAllUsersSortedByNewest(): Promise<AdminUserRow[]> {
  if (sortedUsersCache && sortedUsersCache.expiresAt > Date.now()) {
    return sortedUsersCache.rows;
  }

  const rows: AdminUserRow[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Users",
        ProjectionExpression: USER_PROJECTION,
        ExpressionAttributeNames: USER_PROJECTION_NAMES,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    for (const item of result.Items || []) rows.push(toRow(item));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey && rows.length < SCAN_CAP);

  rows.sort((a, b) => {
    const at = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bt = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bt - at;
  });

  sortedUsersCache = { rows, expiresAt: Date.now() + SORTED_CACHE_TTL_MS };
  return rows;
}

async function listUsers(cursor: string | null): Promise<{
  rows: AdminUserRow[];
  nextCursor: string | null;
}> {
  let offset = 0;
  if (cursor) {
    const parsed = parseInt(Buffer.from(cursor, "base64").toString("utf8"), 10);
    if (Number.isFinite(parsed) && parsed >= 0) offset = parsed;
  }

  const all = await scanAllUsersSortedByNewest();
  const rows = all.slice(offset, offset + PAGE_SIZE);
  const nextOffset = offset + PAGE_SIZE;
  const nextCursor = nextOffset < all.length
    ? Buffer.from(String(nextOffset)).toString("base64")
    : null;

  return { rows, nextCursor };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("query")?.trim() || "";
  const cursor = request.nextUrl.searchParams.get("cursor");

  try {
    if (query) {
      const rows = await attachEmails(await searchUsers(query));
      return NextResponse.json({ users: rows, nextCursor: null });
    }

    const { rows, nextCursor } = await listUsers(cursor);
    return NextResponse.json({ users: await attachEmails(rows), nextCursor });
  } catch (err) {
    console.error("Admin users list failed:", err);
    return NextResponse.json(
      { error: "Couldn't load users right now." },
      { status: 500 }
    );
  }
}
