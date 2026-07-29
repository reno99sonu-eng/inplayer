import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";

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

  return NextResponse.json({ success: true });
}
