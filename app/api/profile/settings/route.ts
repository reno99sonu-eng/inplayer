import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

const PRIVACY_VALUES = ["public", "private", "connections"];
// Fixed section — the profile's first "dedicated section for social media
// links." The second section (freeform label+url pairs) is handled below
// as "other".
const SOCIAL_PLATFORM_KEYS = ["instagram", "youtube", "x", "facebook", "tiktok"];

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Action-based POST (same shape as app/api/creator/kyc) so privacy and
// social links can each be saved independently from their own bit of UI
// without a full-profile round trip.
export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === "update_privacy") {
    const { usernamePrivacy } = body;

    if (!PRIVACY_VALUES.includes(usernamePrivacy)) {
      return NextResponse.json({ error: "Invalid privacy setting." }, { status: 400 });
    }

    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Users",
        Key: { userId: user.userId },
        UpdateExpression: "SET usernamePrivacy = :p, updatedAt = :u",
        ExpressionAttributeValues: {
          ":p": usernamePrivacy,
          ":u": new Date().toISOString(),
        },
      })
    );

    return NextResponse.json({ success: true });
  }

  if (action === "update_name") {
    const { name } = body;
    const trimmed = typeof name === "string" ? name.trim().slice(0, 100) : "";

    if (!trimmed) {
      return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    }

    // This is the app's own stable copy of the display name (see
    // app/lib/verifyAuth.ts) — an explicit save here always wins,
    // overriding whatever got auto-seeded from Cognito earlier.
    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Users",
        Key: { userId: user.userId },
        UpdateExpression: "SET #n = :name, updatedAt = :u",
        ExpressionAttributeNames: { "#n": "name" },
        ExpressionAttributeValues: {
          ":name": trimmed,
          ":u": new Date().toISOString(),
        },
      })
    );

    return NextResponse.json({ success: true });
  }

  if (action === "complete_account") {
    const age = Number(body.age);
    if (!Number.isInteger(age) || age < 13 || age > 120) {
      return NextResponse.json({ error: "You must be at least 13 years old to use InPlayer." }, { status: 400 });
    }
    await docClient.send(new UpdateCommand({
      TableName: "InPlayer-Users",
      Key: { userId: user.userId },
      UpdateExpression: "SET age = :age, termsAcceptedAt = :terms, updatedAt = :updatedAt",
      ExpressionAttributeValues: { ":age": age, ":terms": new Date().toISOString(), ":updatedAt": new Date().toISOString() },
    }));
    return NextResponse.json({ success: true });
  }

  if (action === "accept_terms") {
    await docClient.send(new UpdateCommand({
      TableName: "InPlayer-Users",
      Key: { userId: user.userId },
      UpdateExpression: "SET termsAcceptedAt = :terms, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":terms": new Date().toISOString(),
        ":updatedAt": new Date().toISOString(),
      },
    }));
    return NextResponse.json({ success: true });
  }

  if (action === "update_social_links") {
    const { social, other } = body;

    const cleanSocial: Record<string, string> = {};
    if (social && typeof social === "object") {
      for (const key of SOCIAL_PLATFORM_KEYS) {
        const value = (social as Record<string, unknown>)[key];
        if (typeof value === "string" && value.trim()) {
          const normalized = normalizeUrl(value);
          if (!isValidUrl(normalized)) {
            return NextResponse.json(
              { error: `That doesn't look like a valid link for ${key}.` },
              { status: 400 }
            );
          }
          cleanSocial[key] = normalized;
        }
      }
    }

    const cleanOther: { label: string; url: string }[] = [];
    if (Array.isArray(other)) {
      for (const entry of other.slice(0, 5)) {
        const label =
          typeof entry?.label === "string" ? entry.label.trim().slice(0, 30) : "";
        const rawUrl = typeof entry?.url === "string" ? entry.url.trim() : "";
        if (!label || !rawUrl) continue;

        const normalized = normalizeUrl(rawUrl);
        if (!isValidUrl(normalized)) {
          return NextResponse.json(
            { error: `That doesn't look like a valid link for "${label}".` },
            { status: 400 }
          );
        }
        cleanOther.push({ label, url: normalized });
      }
    }

    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Users",
        Key: { userId: user.userId },
        UpdateExpression: "SET socialLinks = :s, updatedAt = :u",
        ExpressionAttributeValues: {
          ":s": { social: cleanSocial, other: cleanOther },
          ":u": new Date().toISOString(),
        },
      })
    );

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
