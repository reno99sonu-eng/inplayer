import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import {
  AUDIENCE_COOKIE,
  AUDIENCE_COOKIE_MAX_AGE,
  DEFAULT_AUDIENCE_MODE,
  isValidPasskey,
  normalizeAudienceMode,
} from "@/app/lib/contentAccess";

// The 6-digit passkey that guards who can change what content is shown —
// the lock behind the 18+ switch in the hamburger drawer
// (app/components/ContentAccessMenu.tsx).
//
// WHAT IS AND ISN'T LOCKED: only turning 18+ ON. Switching to "kids" or
// back to "family" needs no passkey and no account at all, because both
// show strictly LESS than "all" — a code there would protect nothing while
// making the safest setting the most awkward to reach. modeRequiresPasskey()
// in app/lib/contentAccess.ts is the single definition of that line, shared
// by this route and the UI.
//
// WHY THE PASSKEY LIVES ON THE ACCOUNT, NOT THE DEVICE: a parental control
// stored in localStorage is defeated by clearing site data. This stores
// only a hash of it on the user's own DynamoDB row, so it follows them to
// any device, and clearing browser data doesn't unlock anything — it just
// drops the cookie, which returns the browser to the SAFE default
// ("family", 18+ hidden). Failing that direction is the whole point.
//
// The mode itself rides in an HttpOnly cookie set here, only after the
// passkey has been verified server-side. Client JavaScript can't write an
// HttpOnly cookie, so the toggle can't be flipped from the browser console
// or by a script — the only way to unlock 18+ is a correct passkey through
// this route.
//
// Hashing: scrypt with a per-user random salt, compared with
// timingSafeEqual. A 6-digit code is only a million possibilities, so a
// plain SHA-256 would be trivially reversible from a table; scrypt's work
// factor is what makes the stored hash worth anything if the table ever
// leaked.
const USERS_TABLE = "InPlayer-Users";
const SCRYPT_KEYLEN = 64;

function hashPasskey(passkey: string, salt: string): string {
  return scryptSync(passkey, salt, SCRYPT_KEYLEN).toString("hex");
}

function passkeyMatches(passkey: string, salt: string, expectedHex: string): boolean {
  try {
    const actual = Buffer.from(hashPasskey(passkey, salt), "hex");
    const expected = Buffer.from(expectedHex, "hex");
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function readPasskeyRecord(userId: string) {
  const result = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      ProjectionExpression: "contentPasskeyHash, contentPasskeySalt",
    })
  );
  const hash = result.Item?.contentPasskeyHash as string | undefined;
  const salt = result.Item?.contentPasskeySalt as string | undefined;
  return hash && salt ? { hash, salt } : null;
}

// GET — what the Settings page needs to render its toggles: the mode this
// browser is currently in, and whether a passkey has ever been created.
// Deliberately does NOT require auth: a signed-out visitor still has a mode
// (the safe default), and the page needs to show it.
export async function GET(request: NextRequest) {
  const mode = normalizeAudienceMode(request.cookies.get(AUDIENCE_COOKIE)?.value);

  let hasPasskey = false;
  try {
    const user = await verifyAuth(request);
    hasPasskey = Boolean(await readPasskeyRecord(user.userId));
  } catch {
    // Signed out (or the lookup failed) — hasPasskey stays false, which the
    // UI reads as "you'll need to create one first".
  }

  return NextResponse.json({ mode, hasPasskey });
}

function audienceCookieResponse(mode: string) {
  const response = NextResponse.json({ ok: true, mode });
  response.cookies.set({
    name: AUDIENCE_COOKIE,
    value: mode,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUDIENCE_COOKIE_MAX_AGE,
  });
  return response;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { action } = body as { action?: string };

  // ── Narrowing a mode needs no account and no passkey ───────────────
  //
  // Handled BEFORE the sign-in check on purpose. "family" and "kids" both
  // show strictly less than the browser could see a moment ago (see
  // modeRequiresPasskey), and the person most likely to want the Kids
  // switch — a parent handing over an unlocked phone — is often not signed
  // in at all. Gating it behind an account would make the safest setting
  // the hardest one to reach.
  //
  // Unlocking 18+ still falls through to the authenticated branch below.
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json(
      { error: "Please sign in to change content settings." },
      { status: 401 }
    );
  }

  const existing = await readPasskeyRecord(user.userId);

  // ── Create or change the passkey ───────────────────────────────────
  if (action === "set_passkey") {
    const { passkey, currentPasskey } = body as {
      passkey?: unknown;
      currentPasskey?: unknown;
    };

    if (!isValidPasskey(passkey)) {
      return NextResponse.json(
        { error: "Your passkey must be exactly 6 digits." },
        { status: 400 }
      );
    }

    // Changing an existing passkey requires proving you know the old one —
    // otherwise anyone already signed in on the device could simply
    // overwrite the parent's code and unlock everything.
    if (existing) {
      if (!isValidPasskey(currentPasskey)) {
        return NextResponse.json(
          { error: "Enter your current passkey to change it." },
          { status: 400 }
        );
      }
      if (!passkeyMatches(currentPasskey, existing.salt, existing.hash)) {
        return NextResponse.json({ error: "That passkey is incorrect." }, { status: 403 });
      }
    }

    const salt = randomBytes(16).toString("hex");
    await docClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId: user.userId },
        UpdateExpression:
          "SET contentPasskeyHash = :hash, contentPasskeySalt = :salt, contentPasskeySetAt = :now",
        ExpressionAttributeValues: {
          ":hash": hashPasskey(passkey, salt),
          ":salt": salt,
          ":now": new Date().toISOString(),
        },
      })
    );

    return NextResponse.json({ ok: true, hasPasskey: true });
  }

  // ── Unlock 18+ ─────────────────────────────────────────────────────
  // Only reached for modes modeRequiresPasskey() says are loosening —
  // every narrowing mode already returned above.
  if (action === "set_mode" || action === "reset_mode") {
    const { passkey } = body as { passkey?: unknown };
    const mode = action === "reset_mode"
      ? DEFAULT_AUDIENCE_MODE
      : normalizeAudienceMode((body as { mode?: unknown }).mode);

    if (!existing) {
      return NextResponse.json(
        { error: "Create a 6-digit passkey first.", needsPasskey: true },
        { status: 409 }
      );
    }

    if (!isValidPasskey(passkey) || !passkeyMatches(passkey, existing.salt, existing.hash)) {
      return NextResponse.json({ error: "That passkey is incorrect." }, { status: 403 });
    }

    return audienceCookieResponse(mode);
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
