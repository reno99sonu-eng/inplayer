import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import {
  FREE_MAX_RESOLUTION,
  PREMIUM_MAX_RESOLUTION,
  isPremiumFromRecord,
} from "@/app/lib/premium";

// "Is this viewer Premium, and what's the best rendition they may stream?"
//
// Deliberately does NOT require auth: a signed-out visitor still needs an
// answer (free tier, 1080p ceiling) so the player has a cap to apply rather
// than defaulting to unlimited. Failing to verify simply means not Premium.
//
// The resolution ceiling is returned by the SERVER rather than being decided
// in the browser, so the client never has to know the tier rules — and the
// value it applies to the player came from the account, not from anything a
// viewer could edit in localStorage.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let premium = false;
  let premiumUntil: string | null = null;

  try {
    const user = await verifyAuth(request);
    const result = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Users",
        Key: { userId: user.userId },
        ProjectionExpression: "premiumUntil",
      })
    );

    premium = isPremiumFromRecord(result.Item, Date.now());
    premiumUntil = premium ? ((result.Item?.premiumUntil as string) || null) : null;
  } catch {
    // Signed out, expired token, or a DynamoDB blip — all mean "free tier".
    // Failing closed here costs a viewer nothing but 1440p/4K; failing open
    // would hand away the entire paid benefit on any transient error.
  }

  return NextResponse.json({
    premium,
    premiumUntil,
    maxResolution: premium ? PREMIUM_MAX_RESOLUTION : FREE_MAX_RESOLUTION,
  });
}
