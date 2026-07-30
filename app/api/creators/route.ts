import { NextRequest, NextResponse } from "next/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

const PAGE_SIZE = 24;

export interface PublicCreatorRow {
  userId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

const PROJECTION = "userId, username, #n, avatarUrl, usernamePrivacy";
const PROJECTION_NAMES = { "#n": "name" };

// Public "browse creators" list (app/creators) — unlike the Admin Panel's
// user list, this is reachable by anyone, so it only ever returns accounts
// that have actually claimed a public @handle and haven't set their
// profile to private/connections-only. No email, no suspended-status, no
// anything else admin-only.
export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor");

  let exclusiveStartKey: Record<string, unknown> | undefined;
  if (cursor) {
    try {
      exclusiveStartKey = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    } catch {
      exclusiveStartKey = undefined;
    }
  }

  try {
    // Same tradeoff as the rest of this codebase makes at InPlayer's
    // current scale (see app/api/admin/users): a single bounded Scan per
    // page rather than a maintained index, since there's no per-user
    // secondary index to query by "has a public username" instead.
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Users",
        ProjectionExpression: PROJECTION,
        ExpressionAttributeNames: PROJECTION_NAMES,
        Limit: PAGE_SIZE,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    const creators: PublicCreatorRow[] = (result.Items || [])
      .filter((item) => {
        const hasUsername = typeof item.username === "string" && item.username.length > 0;
        // Missing usernamePrivacy predates that setting and defaults to
        // public everywhere else in the app (see app/api/profile/settings).
        const isPublic = !item.usernamePrivacy || item.usernamePrivacy === "public";
        return hasUsername && isPublic;
      })
      .map((item) => ({
        userId: item.userId as string,
        username: item.username as string,
        name: (item.name as string) || (item.username as string),
        avatarUrl: (item.avatarUrl as string) || null,
      }));

    const nextCursor = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
      : null;

    return NextResponse.json({ creators, nextCursor });
  } catch (err) {
    console.error("Public creators list failed:", err);
    return NextResponse.json(
      { error: "Couldn't load creators right now." },
      { status: 500 }
    );
  }
}
