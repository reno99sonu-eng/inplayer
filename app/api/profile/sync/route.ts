import { NextRequest, NextResponse } from "next/server";
import {
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

// Videos/shorts and comments each keep their own denormalized copy of the
// author's display name + avatar (so every page render doesn't need an
// extra lookup per item). That means a profile edit doesn't retroactively
// show up anywhere on its own — call this right after saving a new name or
// avatar to push the current values onto everything the user has already
// posted.
export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  // The ID token's "name" claim only reflects the profile page's
  // updateUserAttributes() call once the token has actually been
  // refreshed — the profile page force-refreshes the session before
  // calling this endpoint, so this is the live value.
  const name = user.name || "Unknown";

  const avatarResult = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Users",
      Key: { userId: user.userId },
    })
  );
  const avatarUrl = avatarResult.Item?.avatarUrl || null;

  try {
    const videosResult = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        FilterExpression: "uploaderId = :uid",
        ExpressionAttributeValues: { ":uid": user.userId },
      })
    );

    await Promise.all(
      (videosResult.Items || []).map((item) =>
        docClient.send(
          new UpdateCommand({
            TableName: "InPlayer-Videos",
            Key: { videoId: item.videoId },
            UpdateExpression:
              "SET uploaderName = :name, uploaderAvatarUrl = :avatar",
            ExpressionAttributeValues: { ":name": name, ":avatar": avatarUrl },
          })
        )
      )
    );

    const commentsResult = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Comments",
        FilterExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": user.userId },
      })
    );

    await Promise.all(
      (commentsResult.Items || []).map((item) =>
        docClient.send(
          new UpdateCommand({
            TableName: "InPlayer-Comments",
            Key: { videoId: item.videoId, commentId: item.commentId },
            UpdateExpression:
              "SET userName = :name, userAvatarUrl = :avatar",
            ExpressionAttributeValues: { ":name": name, ":avatar": avatarUrl },
          })
        )
      )
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to sync profile to existing content:", err);
    return NextResponse.json(
      { error: "Saved your profile, but couldn't update your older posts." },
      { status: 500 }
    );
  }
}
