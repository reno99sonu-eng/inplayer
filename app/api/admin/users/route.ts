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

// No query: plain browse, newest first — scan ALL users (no Limit on the
// DynamoDB side so we don't cut mid-sort), collect every item in memory,
// sort by createdAt descending, then page by numeric offset.  At InPlayer's
// current scale a full scan of a few-thousand-row table takes well under
// 100 ms and fits in a single Lambda invocation with room to spare — the
// same in-memory sort tradeoff already used in app/lib/videoStore.ts.
async function listUsers(cursor: string | null): Promise<{
  rows: AdminUserRow[];
  nextCursor: string | null;
}> {
  // Decode numeric offset from base64 cursor (or start at 0).
  let offset = 0;
  if (cursor) {
    try {
      const decoded = Buffer.from(cursor, "base64").toString("utf8");
      const parsed = parseInt(decoded, 10);
      if (!isNaN(parsed) && parsed >= 0) offset = parsed;
    } catch {
      offset = 0;
    }
  }

  // Full table scan — no Limit so we get every user for in-memory sort.
  const allItems: Record<string, unknown>[] = [];
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
    allItems.push(...((result.Items || []) as Record<string, unknown>[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  // Sort newest accounts first (ISO-8601 strings sort lexicographically).
  allItems.sort((a, b) => {
    const aDate = (a.createdAt as string) || "";
    const bDate = (b.createdAt as string) || "";
    if (bDate > aDate) return 1;
    if (bDate < aDate) return -1;
    return 0;
  });

  const page = allItems.slice(offset, offset + PAGE_SIZE).map(toRow);
  const nextOffset = offset + PAGE_SIZE;
  const nextCursor =
    nextOffset < allItems.length
      ? Buffer.from(String(nextOffset)).toString("base64")
      : null;

  return { rows: page, nextCursor };
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
