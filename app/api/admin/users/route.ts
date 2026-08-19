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

// No query: plain browse, newest first isn't possible without a table
// scan + sort (createdAt isn't indexed) — at InPlayer's current scale a
// single bounded Scan sorted in memory is fine, same tradeoff the rest of
// this codebase already makes (see app/lib/videoStore.ts).
async function listUsers(cursor: string | null): Promise<{
  rows: AdminUserRow[];
  nextCursor: string | null;
}> {
  let exclusiveStartKey: Record<string, unknown> | undefined;
  if (cursor) {
    try {
      exclusiveStartKey = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    } catch {
      exclusiveStartKey = undefined;
    }
  }

  const result = await docClient.send(
    new ScanCommand({
      TableName: "InPlayer-Users",
      ProjectionExpression: USER_PROJECTION,
      ExpressionAttributeNames: USER_PROJECTION_NAMES,
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
