import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { deleteUserCascade } from "@/app/lib/cascadeDelete";
import { logAdminAction } from "@/app/lib/auditLog";

// Suspend/unsuspend a user. Setting isSuspended: true takes effect
// immediately and everywhere — app/lib/verifyAuth.ts checks this same
// field on every single signed-in request across the site, so a suspended
// account is blocked from uploading, liking, commenting, and messaging the
// instant this is flipped, with no separate "kick them out" step needed.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // An admin can't suspend their own account — that would lock them out of
  // the Admin Panel itself (verifyAuth blocks suspended accounts on every
  // route, including /api/admin/*), with no way back in except editing the
  // database by hand.
  if (userId === admin.userId) {
    return NextResponse.json(
      { error: "You can't suspend your own admin account." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.isSuspended !== "boolean") {
    return NextResponse.json(
      { error: "isSuspended (true/false) is required." },
      { status: 400 }
    );
  }

  await docClient.send(
    new UpdateCommand({
      TableName: "InPlayer-Users",
      Key: { userId },
      UpdateExpression: "SET isSuspended = :s, updatedAt = :u",
      ExpressionAttributeValues: {
        ":s": body.isSuspended,
        ":u": new Date().toISOString(),
      },
    })
  );

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: body.isSuspended ? "user.suspend" : "user.unsuspend",
    targetType: "user",
    targetId: userId,
  });

  return NextResponse.json({ success: true });
}

// Real, permanent, immediate account deletion — everything the account
// owns across every table this app uses, every video's Mux asset, any
// active paid membership actually cancelled at Razorpay (not just
// deleted from our own database), and the real Cognito sign-in account
// itself so this person can never sign back in. See
// app/lib/cascadeDelete.ts for the full, table-by-table breakdown and the
// two deliberate exceptions (revenue ledger anonymized not deleted;
// messages/conversations left alone, matching the existing self-service
// account-delete policy). There is no undo.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  // Same reasoning as the suspend guard above — deleting your own admin
  // account here would have no way back in except editing the database
  // by hand.
  if (userId === admin.userId) {
    return NextResponse.json(
      { error: "You can't delete your own admin account." },
      { status: 400 }
    );
  }

  const result = await deleteUserCascade(userId);
  if (!result.success && result.errors[0] === "User not found.") {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (!result.success) {
    console.error(`Admin delete: user ${userId} had partial failures:`, result.errors);
  }

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "user.delete",
    targetType: "user",
    targetId: userId,
    details:
      result.errors.length > 0
        ? `Completed with ${result.errors.length} warning(s) — see server logs.`
        : undefined,
  });

  return NextResponse.json({ success: true, warnings: result.errors });
}
