import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { deleteUserCascade } from "@/app/lib/cascadeDelete";

// Real account deletion, called from Settings -> Account & Privacy ->
// Delete Account. Reuses the exact same deleteUserCascade() the Admin
// Panel's own "Delete user" action uses (app/lib/cascadeDelete.ts) — the
// two used to be different, narrower implementations (this route only
// deleted videos/username/profile, not memberships/likes/history/etc.),
// which is why self-deleting an account with an active paid membership
// used to leave that membership still billing at Razorpay, and left
// likes/watch history/watchlist/playlists/notifications/reports/
// subscriptions behind even though the account itself looked "deleted."
// There is now exactly one definition of "a user account is really gone,"
// shared by both entry points.
//
// This also changes WHO deletes the Cognito login: deleteUserCascade's own
// last step calls deleteCognitoUser(userId) with admin credentials
// server-side — the client no longer needs to (and must not) call
// deleteUser() from aws-amplify/auth itself afterward, since that call
// would just fail against an account Cognito no longer has (see
// DeleteAccountCard.tsx, which now only signs the local session out).
export async function DELETE(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const result = await deleteUserCascade(user.userId);

  if (!result.success && result.errors[0] === "User not found.") {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  if (!result.success) {
    console.error(`Self-service delete: user ${user.userId} had partial failures:`, result.errors);
  }

  return NextResponse.json({ success: true, warnings: result.errors });
}
