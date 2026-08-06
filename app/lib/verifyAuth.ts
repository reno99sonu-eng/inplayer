import { CognitoJwtVerifier } from "aws-jwt-verify";
import { NextRequest } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { sessionStillActive } from "@/app/lib/sessions";

// ── In-memory TTL cache for the DynamoDB suspension/name check ──────
// verifyAuth runs on EVERY authenticated API request (50+ routes), and
// each call was hitting DynamoDB to check isSuspended + resolve the
// user's display name. For a user clicking around the site, that's
// 10-20+ DB round-trips in a few seconds — all returning the same data.
//
// This cache stores the result for 30 seconds. First request in any 30s
// window does the real DB lookup (exactly as before); subsequent requests
// get the cached answer instantly. Suspended users are still blocked
// (the cached result includes isSuspended: true). An admin suspending
// someone takes effect within 30s max — the same order of magnitude as
// Cognito's own token expiry window, and far faster than any user would
// notice.
const AUTH_CACHE_TTL_MS = 30_000;
interface AuthCacheEntry {
  isSuspended: boolean;
  suspendedUntil?: string;
  name?: string;
  cachedAt: number;
}
const authCache = new Map<string, AuthCacheEntry>();

// These match the values in amplify-config.ts — same User Pool, same
// App Client, just verified here on the server instead of trusted
// blindly from the browser.
const verifier = CognitoJwtVerifier.create({
  userPoolId: "ap-south-1_OrIhWadFN",
  tokenUse: "id",
  clientId: "1ckejhd5mp3oohgsfuqseeda5t",
});

export interface VerifiedUser {
  userId: string;
  email?: string;
  name?: string;
}

// Every call site that catches verifyAuth() rejecting a request already
// treats it as "not signed in" (401) — this reuses that exact same path
// for a suspended account, so Admin Panel -> Users -> Suspend genuinely
// blocks every signed-in action (uploading, liking, commenting,
// messaging, etc.) sitewide the moment it's flipped on, with no changes
// needed anywhere else.
const SUSPENDED_MESSAGE = "Account suspended";

// Strike 2 of the AI moderation 3-strike system (see
// app/lib/moderationStrikes.ts) is a temporary block, not a permanent
// suspension — same enforcement path (any verifyAuth rejection is a 401
// everywhere), different message purely for server-log clarity. An
// expired suspendedUntil is treated as if it were never set at all; there
// is no cron/TTL job that clears the field, it's just ignored once it's
// in the past.
const TEMP_BLOCKED_MESSAGE = "Account temporarily blocked";

// Thrown when a request explicitly identifies which device/session it's
// from (via X-Session-Id — see app/lib/apiFetch.ts) and that session has
// since been logged out (Settings > Privacy, or an admin forcing it) — see
// app/lib/sessions.ts for why this app-level check exists instead of a
// Cognito token revocation. A request with NO X-Session-Id header (an
// older cached page, or a route this app hasn't wired up yet) always
// skips this check rather than being blocked by it.
const SESSION_REVOKED_MESSAGE = "Signed out of this device";

// Call this at the top of any API route that should only work for
// signed-in users (uploading, liking, commenting, etc.). It expects
// the browser to send the current Cognito ID token in the
// Authorization header as "Bearer <token>". Throws if missing, invalid,
// or the account is suspended — callers should catch this and respond
// with 401.
export async function verifyAuth(request: NextRequest): Promise<VerifiedUser> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    throw new Error("Missing authorization token");
  }

  const payload = await verifier.verify(token);
  const userId = payload.sub;
  const jwtName = typeof payload.name === "string" ? payload.name : undefined;

  // The ID token's "name" claim is Cognito's own live attribute value —
  // and for a Google-linked account, Cognito silently overwrites that
  // attribute from the Google profile's own name on every Google sign-in
  // (that's just how the identity provider's attribute mapping works).
  // Without this, someone who signs up as "Reno" would see their name
  // flip to whatever their Google account happens to be named the next
  // time they use "Continue with Google". InPlayer-Users.name is this
  // app's own, stable copy: once set, it's the one true display name
  // regardless of which method someone signs in with — Cognito's copy is
  // only ever used as a one-time seed the very first time a person is
  // ever seen with no stored name yet.
  let resolvedName = jwtName;

  // Fails OPEN on any lookup problem (missing row, a transient DynamoDB
  // error, etc.) — only an explicit isSuspended: true on the account's own
  // row blocks it. This is deliberate: a bug or blip in this one check must
  // never be able to take down sign-in-gated actions for every user on the
  // site, only the one row an admin actually suspended.
  //
  // Performance: the result is cached in-memory for 30s (see authCache
  // above) so rapid-fire requests from the same user don't each make their
  // own DynamoDB round-trip. The cached entry includes isSuspended, so
  // suspended users are still blocked instantly from cache.
  try {
    const now = Date.now();
    const cached = authCache.get(userId);
    let isSuspended = false;
    let suspendedUntil: string | undefined;
    let storedName: string | undefined;

    if (cached && now - cached.cachedAt < AUTH_CACHE_TTL_MS) {
      // Cache hit — use the stored result without touching DynamoDB.
      isSuspended = cached.isSuspended;
      suspendedUntil = cached.suspendedUntil;
      storedName = cached.name;
    } else {
      // Cache miss or expired — do the real DynamoDB lookup.
      const result = await docClient.send(
        new GetCommand({
          TableName: "InPlayer-Users",
          Key: { userId },
          ProjectionExpression: "isSuspended, suspendedUntil, #n",
          ExpressionAttributeNames: { "#n": "name" },
        })
      );
      isSuspended = result.Item?.isSuspended === true;
      suspendedUntil = result.Item?.suspendedUntil as string | undefined;
      storedName = result.Item?.name as string | undefined;

      // Cache the result (including suspended status — enforcement still
      // happens below, just from the cached copy on the next request).
      authCache.set(userId, {
        isSuspended,
        suspendedUntil,
        name: storedName,
        cachedAt: now,
      });

      // Seed initial name (first time ever) — only on a real DB lookup,
      // never from cache (the UpdateCommand is conditional anyway).
      if (!storedName && jwtName) {
        try {
          await docClient.send(
            new UpdateCommand({
              TableName: "InPlayer-Users",
              Key: { userId },
              UpdateExpression: "SET #n = :name",
              ConditionExpression: "attribute_not_exists(#n)",
              ExpressionAttributeNames: { "#n": "name" },
              ExpressionAttributeValues: { ":name": jwtName },
            })
          );
          storedName = jwtName;
          // Update cache with the seeded name so subsequent requests
          // within the TTL window see it immediately.
          authCache.set(userId, { isSuspended, suspendedUntil, name: storedName, cachedAt: now });
        } catch (seedErr) {
          // ConditionalCheckFailedException just means someone else won the
          // race (or already has a real saved name) — not a real error.
          const name = (seedErr as { name?: string } | undefined)?.name;
          if (name !== "ConditionalCheckFailedException") {
            console.error("verifyAuth: failed to seed initial name:", seedErr);
          }
        }
      }
    }

    if (isSuspended) {
      throw new Error(SUSPENDED_MESSAGE);
    }
    if (suspendedUntil && new Date(suspendedUntil).getTime() > Date.now()) {
      throw new Error(TEMP_BLOCKED_MESSAGE);
    }

    if (storedName) {
      resolvedName = storedName;
    }
  } catch (err) {
    if (err instanceof Error && (err.message === SUSPENDED_MESSAGE || err.message === TEMP_BLOCKED_MESSAGE)) {
      throw err;
    }
    console.error("verifyAuth: suspension/name check failed, failing open:", err);
  }

  const sessionId = request.headers.get("x-session-id");
  if (sessionId) {
    const active = await sessionStillActive(userId, sessionId);
    if (!active) {
      throw new Error(SESSION_REVOKED_MESSAGE);
    }
  }

  return {
    userId,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: resolvedName,
  };
}