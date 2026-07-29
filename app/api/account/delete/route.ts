import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import mux from "@/app/lib/mux";

// Real account deletion, called from Settings -> Account & Privacy ->
// Delete Account. This is the DATA half of deletion — cleaning up
// everything server-side while the caller's session is still valid.
// Deleting the actual Cognito login (which ends that session) happens
// client-side straight afterward, via deleteUser() from aws-amplify/auth —
// the same call app/components/auth/AuthProvider.tsx's handleRejectTerms
// already uses. It has to happen in that order: once the Cognito account
// is gone, this route's own verifyAuth() would no longer work.
//
// Scope: deletes every video/Short the user uploaded (Mux asset +
// database row, same real cleanup app/api/my-videos/[videoId]'s DELETE
// does) plus their profile row and username reservation. Comments and
// direct messages they've posted are deliberately left alone — both store
// a snapshot of the name/avatar at post time rather than a live lookup, so
// they keep rendering correctly either way, and removing someone's side of
// every conversation would also gut the OTHER participant's message
// history, which isn't this account's to delete.
export async function DELETE(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const errors: string[] = [];

  // 1. Delete every video/Short this account uploaded.
  try {
    const videos = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        FilterExpression: "uploaderId = :uid",
        ExpressionAttributeValues: { ":uid": user.userId },
        ProjectionExpression: "videoId, muxAssetId",
      })
    );

    for (const item of videos.Items || []) {
      if (item.muxAssetId) {
        try {
          await mux.video.assets.delete(item.muxAssetId as string);
        } catch (err) {
          console.error("Account deletion: failed to delete Mux asset (continuing):", err);
        }
      }
      try {
        await docClient.send(
          new DeleteCommand({ TableName: "InPlayer-Videos", Key: { videoId: item.videoId } })
        );
      } catch (err) {
        console.error("Account deletion: failed to delete a video row:", err);
        errors.push("Some of your videos couldn't be removed.");
      }
    }
  } catch (err) {
    console.error("Account deletion: video scan failed:", err);
    errors.push("Couldn't check for your videos.");
  }

  // 2. Release the username reservation, if any.
  try {
    const profile = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Users",
        Key: { userId: user.userId },
        ProjectionExpression: "usernameLower",
      })
    );
    const usernameLower = profile.Item?.usernameLower;
    if (usernameLower) {
      await docClient.send(
        new DeleteCommand({ TableName: "InPlayer-Usernames", Key: { usernameLower } })
      );
    }
  } catch (err) {
    console.error("Account deletion: failed to release username:", err);
  }

  // 3. Delete the profile row itself.
  try {
    await docClient.send(
      new DeleteCommand({ TableName: "InPlayer-Users", Key: { userId: user.userId } })
    );
  } catch (err) {
    console.error("Account deletion: failed to delete profile row:", err);
    errors.push("Couldn't fully remove your profile data.");
  }

  return NextResponse.json({ success: true, errors });
}
