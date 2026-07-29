import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

// Same DynamoDB-item-embedded-image pattern as app/api/profile/avatar
// (see that route for the full "why no S3" reasoning) — a cover photo is
// just another base64 data URL living on the same InPlayer-Users item.
// Kept far smaller than the avatar's own 350KB cap because BOTH now share
// DynamoDB's single hard 400KB-per-item limit alongside username,
// socialLinks, description, etc. — a generous cap here could silently
// break the avatar save (or vice versa) for someone who's maxed out both.
const COVER_PHOTO_MAX_LENGTH = 45_000;
// Headroom deliberately left, on top of that, for every other attribute
// this item carries — checked below against whatever avatarUrl already
// exists, so the two images can never combine to blow past the real
// DynamoDB limit no matter how large either is individually allowed to be.
const COMBINED_IMAGE_SAFETY_BUDGET = 380_000;

export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { coverPhotoUrl } = await request.json();

  // null/undefined is how the client asks to REMOVE the cover photo —
  // only reject values that are neither a real string nor "no value."
  if (coverPhotoUrl != null && typeof coverPhotoUrl !== "string") {
    return NextResponse.json({ error: "Invalid image data." }, { status: 400 });
  }

  if (coverPhotoUrl) {
    if (coverPhotoUrl.length > COVER_PHOTO_MAX_LENGTH) {
      return NextResponse.json(
        { error: "That image is too large. Please choose a smaller photo." },
        { status: 400 }
      );
    }

    const existing = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Users",
        Key: { userId: user.userId },
        ProjectionExpression: "avatarUrl",
      })
    );
    const avatarLength = (existing.Item?.avatarUrl as string | undefined)?.length || 0;

    if (avatarLength + coverPhotoUrl.length > COMBINED_IMAGE_SAFETY_BUDGET) {
      return NextResponse.json(
        {
          error:
            "That image is too large together with your current profile photo. Please choose a smaller cover photo, or a smaller profile photo first.",
        },
        { status: 400 }
      );
    }
  }

  // UpdateCommand, not PutCommand — this item also carries username,
  // avatarUrl, usernamePrivacy, and socialLinks. A Put here would silently
  // replace the whole item and wipe those out.
  await docClient.send(
    new UpdateCommand({
      TableName: "InPlayer-Users",
      Key: { userId: user.userId },
      UpdateExpression: coverPhotoUrl
        ? "SET coverPhotoUrl = :coverPhotoUrl, updatedAt = :updatedAt"
        : "REMOVE coverPhotoUrl SET updatedAt = :updatedAt",
      ExpressionAttributeValues: coverPhotoUrl
        ? { ":coverPhotoUrl": coverPhotoUrl, ":updatedAt": new Date().toISOString() }
        : { ":updatedAt": new Date().toISOString() },
    })
  );

  return NextResponse.json({ success: true });
}
