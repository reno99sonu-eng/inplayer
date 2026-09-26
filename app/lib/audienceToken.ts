import { createHmac, timingSafeEqual } from "crypto";
import {
  AUDIENCE_COOKIE_MAX_AGE,
  DEFAULT_AUDIENCE_MODE,
  type AudienceMode,
} from "./contentAccess";

// Server-only. What travels in the inplayer-audience cookie (and the
// app's matching header) is an "audience value":
//
//   "family" / "kids"            — plain strings. Honored as-is: both only
//                                  ever hide content, so forging one gains
//                                  nothing.
//   "all.<uid>.<exp>.<sig>"      — the only form "all" (18+) is honored in.
//                                  Issued by app/api/content-access/route.ts
//                                  only after the passkey is verified, and
//                                  HMAC-signed so no client can mint one.
//
// Anything else — including a bare "all", which any script or app can send —
// resolves to the safe default.

const ADULT_PREFIX = "all.";

function signingKey(): Buffer | null {
  const dedicated = process.env.CONTENT_ACCESS_SECRET;
  if (dedicated) return Buffer.from(dedicated, "utf8");
  // Falls back to a key derived one-way from an existing server-only secret
  // so this works without new config. Rotating that secret just returns
  // everyone to the safe default until they re-enter their passkey.
  const aws = process.env.AWS_SECRET_ACCESS_KEY;
  if (aws) return createHmac("sha256", aws).update("inplayer:content-access:v1").digest();
  return null;
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** Returns null when no signing key is configured — callers must then
 *  refuse to unlock 18+ rather than fall back to an unsigned value. */
export function issueAdultAudienceValue(userId: string): string | null {
  const key = signingKey();
  if (!key) return null;
  const exp = Math.floor(Date.now() / 1000) + AUDIENCE_COOKIE_MAX_AGE;
  const payload = `${ADULT_PREFIX}${Buffer.from(userId, "utf8").toString("base64url")}.${exp}`;
  return `${payload}.${sign(payload, key)}`;
}

function isValidAdultValue(value: string): boolean {
  const key = signingKey();
  if (!key) return false;

  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "all") return false;
  const [, uid, expRaw, sig] = parts;
  if (!uid || !/^\d+$/.test(expRaw)) return false;
  if (Number(expRaw) < Math.floor(Date.now() / 1000)) return false;

  const expected = Buffer.from(sign(`${ADULT_PREFIX}${uid}.${expRaw}`, key));
  const actual = Buffer.from(sig);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function audienceModeFromValue(raw: string | null | undefined): AudienceMode {
  if (raw === "family" || raw === "kids") return raw;
  if (typeof raw === "string" && raw.startsWith(ADULT_PREFIX) && isValidAdultValue(raw)) {
    return "all";
  }
  return DEFAULT_AUDIENCE_MODE;
}
