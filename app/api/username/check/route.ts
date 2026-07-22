import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import {
  normalizeUsername,
  isValidUsernameFormat,
  isReservedUsername,
} from "@/app/lib/username";

async function ownerOf(usernameLower: string): Promise<string | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Usernames",
      Key: { usernameLower },
    })
  );
  return (result.Item?.userId as string | undefined) || null;
}

// Generates a small number of plausible alternatives when the requested
// username is taken — appends short numeric suffixes / a prefix — and
// only returns ones actually confirmed available right now.
async function suggestAlternatives(base: string, userId: string): Promise<string[]> {
  const candidates = Array.from(
    new Set(
      [
        `${base}${Math.floor(10 + Math.random() * 90)}`,
        `${base}_${Math.floor(1 + Math.random() * 9)}`,
        `${base}${Math.floor(100 + Math.random() * 900)}`,
        `the_${base}`,
        `${base}_official`,
        `real_${base}`,
        `${base}${Math.floor(10 + Math.random() * 90)}`,
      ].filter((c) => isValidUsernameFormat(c))
    )
  );

  const suggestions: string[] = [];
  for (const candidate of candidates) {
    if (suggestions.length >= 3) break;
    const lower = normalizeUsername(candidate);
    if (isReservedUsername(lower)) continue;
    const takenBy = await ownerOf(lower);
    if (!takenBy || takenBy === userId) suggestions.push(candidate);
  }
  return suggestions;
}

export async function GET(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const raw = request.nextUrl.searchParams.get("username") || "";

  if (!isValidUsernameFormat(raw)) {
    return NextResponse.json({
      available: false,
      reason:
        "3-20 characters, starting with a letter — letters, numbers, and underscores only.",
    });
  }

  const lower = normalizeUsername(raw);

  try {
    if (isReservedUsername(lower)) {
      return NextResponse.json({
        available: false,
        reason: "That username is reserved.",
        suggestions: await suggestAlternatives(lower, user.userId),
      });
    }

    const takenBy = await ownerOf(lower);

    if (!takenBy || takenBy === user.userId) {
      return NextResponse.json({ available: true, isCurrent: takenBy === user.userId });
    }

    return NextResponse.json({
      available: false,
      reason: "That username is already taken.",
      suggestions: await suggestAlternatives(lower, user.userId),
    });
  } catch (err) {
    // Almost certainly means InPlayer-Usernames doesn't exist yet in
    // DynamoDB (usernameLower as the partition key).
    console.error("Username check unavailable:", err);
    return NextResponse.json({
      available: false,
      reason: "Username checking isn't available yet. Please try again shortly.",
    });
  }
}
