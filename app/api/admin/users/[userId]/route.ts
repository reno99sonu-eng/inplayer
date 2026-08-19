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
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // ── Grant / revoke InPlayer Premium ─────────────────────────────────
  //
  // Premium is stored as a single `premiumUntil` date on the user's row and
  // read by app/lib/premium.ts's isPremiumFromRecord — anything absent,
  // expired or unparseable is simply "free". Billing isn't wired up yet
  // (nothing charges anyone), so until it is, this is how an account
  // actually becomes Premium; without it the only way was editing DynamoDB
  // by hand, which isn't a thing to ask of whoever is running the site.
  //
  // When billing does land, the Razorpay webhook writes this same field and
  // nothing else has to change.
  if (typeof body.premiumMonths === "number" || body.premium === false) {
    let premiumUntil: string | null = null;

    if (body.premium !== false) {
      const months = Math.max(1, Math.min(120, Math.floor(body.premiumMonths)));
      const expiry = new Date();
      // setMonth handles year rollover and clamps day-of-month itself, so
      // granting 1 month on the 31st lands correctly in a 30-day month.
      expiry.setMonth(expiry.getMonth() + months);
      premiumUntil = expiry.toISOString();
    }

    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Users",
        Key: { userId },
        // Revoking REMOVEs the attribute rather than writing a past date —
        // a stale date left lying around reads as "was premium until X",
        // which is misleading when it was actually revoked.
        UpdateExpression: premiumUntil
          ? "SET premiumUntil = :p, updatedAt = :u"
          : "REMOVE premiumUntil SET updatedAt = :u",
        ExpressionAttributeValues: premiumUntil
          ? { ":p": premiumUntil, ":u": new Date().toISOString() }
          : { ":u": new Date().toISOString() },
      })
    );

    await logAdminAction({
      request,
      adminId: admin.userId,
      adminEmail: admin.email,
      action: premiumUntil ? "premium.grant" : "premium.revoke",
      targetType: "user",
      targetId: userId,
      details: premiumUntil ? `Premium until ${premiumUntil}` : "Premium revoked",
    });

    return NextResponse.json({ success: true, premiumUntil });
  }

  // ── Suspend / unsuspend ─────────────────────────────────────────────
  if (typeof body.isSuspended !== "boolean") {
    return NextResponse.json(
      { error: "isSuspended (true/false) or premiumMonths is required." },
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
