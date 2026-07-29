import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { normalizeUsername } from "@/app/lib/username";

const PAGE_SIZE = 25;

export interface AdminUserRow {
  userId: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  isSuspended: boolean;
}

function toRow(item: Record<string, unknown>): AdminUserRow {
  return {
    userId: item.userId as string,
    username: (item.username as string) || null,
    name: (item.name as string) || null,
    avatarUrl: (item.avatarUrl as string) || null,
    createdAt: (item.createdAt as string) || null,
    isSuspended: item.isSuspended === true,
  };
}

const USER_PROJECTION =
  "userId, username, #n, avatarUrl, createdAt, isSuspended";
const USER_PROJECTION_NAMES = { "#n": "name" };

// Free-text search: real accounts only, matched by username (InPlayer's
// only indexed-ish lookup — see app/lib/userSearch.ts, this mirrors that
// same Scan-and-filter approach on the small InPlayer-Usernames table,
// then hydrates full rows from InPlayer-Users). Email is NOT stored in
// InPlayer-Users at all (it lives only in Cognito), so it can't be
// searched or shown here without adding a separate Cognito lookup — a
// real gap, not a bug, flagged here rather than faked.
async function searchUsers(query: string): Promise<AdminUserRow[]> {
  const q = normalizeUsername(query);
  if (!q) return [];

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
    .sort((a, b) => {
      const aStarts = a.username.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.username.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.username.length - b.username.length;
    })
    .slice(0, PAGE_SIZE);

  if (top.length === 0) return [];

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

  return (result.Responses?.["InPlayer-Users"] || []).map(toRow);
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
      const rows = await searchUsers(query);
      return NextResponse.json({ users: rows, nextCursor: null });
    }

    const { rows, nextCursor } = await listUsers(cursor);
    return NextResponse.json({ users: rows, nextCursor });
  } catch (err) {
    console.error("Admin users list failed:", err);
    return NextResponse.json(
      { error: "Couldn't load users right now." },
      { status: 500 }
    );
  }
}
