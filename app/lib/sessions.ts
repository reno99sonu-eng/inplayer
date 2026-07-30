import { randomUUID } from "crypto";
import {
  PutCommand,
  QueryCommand,
  GetCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { AdminUserGlobalSignOutCommand } from "@aws-sdk/client-cognito-identity-provider";
import { docClient } from "@/app/lib/dynamodb";
import { cognitoClient, COGNITO_USER_POOL_ID, resolveCognitoUsername } from "@/app/lib/cognitoClient";

// Real, revocable login sessions — one row per signed-in device.
//
// How "log out" actually takes effect (important — this is deliberately
// NOT Cognito's RevokeToken API): Amplify v6's public SDK never exposes
// the raw refresh token to app code (by design, for security), so there is
// no legitimate way to grab a specific device's refresh token and revoke
// just that one via Cognito. Instead, every authenticated request can
// optionally carry an `X-Session-Id` header (see app/lib/apiFetch.ts on
// the client, and the check in app/lib/verifyAuth.ts on the server) —
// deleting a session row here means that device's NEXT authenticated
// request gets rejected and it's treated as signed out, same end result,
// just enforced by this app instead of by Cognito. The presence heartbeat
// in AuthProvider.tsx (every 45s, for every signed-in tab) guarantees that
// "next request" happens quickly even if the person doesn't click
// anything. "Log out of ALL devices" is different: that uses Cognito's own
// AdminUserGlobalSignOutCommand, which really does invalidate every token
// Cognito has issued for the account, instantly, no waiting on a request.
export const SESSIONS_TABLE = "InPlayer-Sessions";

// "max 5 devices at the same time" — a 6th sign-in evicts the oldest
// still-active session rather than blocking the new one.
export const MAX_CONCURRENT_SESSIONS = 5;

export interface SessionRow {
  userId: string;
  sessionId: string;
  device: string | null;
  location: string | null;
  ipAddress: string | null;
  createdAt: string;
}

// Called right after a real, fresh sign-in (see AuthProvider.tsx) — never
// on a passive session-restore, so navigating around the site or
// refreshing a tab never creates duplicate rows for the same login.
export async function registerSession(params: {
  userId: string;
  device: string | null;
  location: string | null;
  ipAddress: string | null;
}): Promise<{ sessionId: string; tableMissing?: boolean }> {
  const sessionId = randomUUID();

  try {
    const existing = await docClient.send(
      new QueryCommand({
        TableName: SESSIONS_TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": params.userId },
      })
    );
    const rows = (existing.Items || []) as SessionRow[];

    if (rows.length >= MAX_CONCURRENT_SESSIONS) {
      const oldest = [...rows].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];
      if (oldest) {
        await docClient.send(
          new DeleteCommand({
            TableName: SESSIONS_TABLE,
            Key: { userId: oldest.userId, sessionId: oldest.sessionId },
          })
        );
      }
    }

    await docClient.send(
      new PutCommand({
        TableName: SESSIONS_TABLE,
        Item: {
          userId: params.userId,
          sessionId,
          device: params.device,
          location: params.location,
          ipAddress: params.ipAddress,
          createdAt: new Date().toISOString(),
        },
      })
    );

    return { sessionId };
  } catch (err) {
    console.error("registerSession: failed (table may not exist yet):", err);
    // Never blocks sign-in over this — a missing/broken sessions table
    // should degrade to "no device list yet," not lock people out.
    return { sessionId, tableMissing: true };
  }
}

export async function listSessions(
  userId: string
): Promise<{ sessions: SessionRow[]; tableMissing: boolean }> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: SESSIONS_TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": userId },
      })
    );
    const rows = ((result.Items || []) as SessionRow[]).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return { sessions: rows, tableMissing: false };
  } catch (err) {
    console.error("listSessions: query failed (table may not exist yet):", err);
    return { sessions: [], tableMissing: true };
  }
}

// True if this exact (userId, sessionId) is still an active row — the
// enforcement check verifyAuth.ts runs whenever a request carries an
// X-Session-Id header. Fails OPEN (returns true) on an infra error, same
// "a blip in one check must never take down sign-in-gated actions
// sitewide" convention as the isSuspended check right next to it.
export async function sessionStillActive(userId: string, sessionId: string): Promise<boolean> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: SESSIONS_TABLE,
        Key: { userId, sessionId },
      })
    );
    return Boolean(result.Item);
  } catch (err) {
    console.error("sessionStillActive: lookup failed, failing open:", err);
    return true;
  }
}

// Logs out exactly one device — the one that owns sessionId. Returns false
// if that session doesn't belong to userId (caller should treat as 404).
export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  const existing = await docClient.send(
    new GetCommand({ TableName: SESSIONS_TABLE, Key: { userId, sessionId } })
  );
  if (!existing.Item) return false;

  await docClient.send(
    new DeleteCommand({ TableName: SESSIONS_TABLE, Key: { userId, sessionId } })
  );
  return true;
}

// "Log out of all devices" — AdminUserGlobalSignOut revokes every
// refresh/access token Cognito has issued this account in one call,
// instantly (unlike the per-row delete above, which relies on that
// device's next request to take effect). Every session row is cleared too
// so the list reads empty immediately rather than stale.
export async function revokeAllSessions(userId: string): Promise<void> {
  try {
    const cognitoUsername = await resolveCognitoUsername(userId);
    if (cognitoUsername) {
      await cognitoClient.send(
        new AdminUserGlobalSignOutCommand({
          UserPoolId: COGNITO_USER_POOL_ID,
          Username: cognitoUsername,
        })
      );
    }
  } catch (err) {
    console.error("revokeAllSessions: AdminUserGlobalSignOut failed:", err);
  }

  try {
    const existing = await docClient.send(
      new QueryCommand({
        TableName: SESSIONS_TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": userId },
      })
    );
    const rows = (existing.Items || []) as SessionRow[];
    await Promise.all(
      rows.map((row) =>
        docClient.send(
          new DeleteCommand({
            TableName: SESSIONS_TABLE,
            Key: { userId: row.userId, sessionId: row.sessionId },
          })
        )
      )
    );
  } catch (err) {
    console.error("revokeAllSessions: failed to clear session rows:", err);
  }
}
