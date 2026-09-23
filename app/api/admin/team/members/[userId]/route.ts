import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminEmail } from "@/app/lib/isAdmin";
import { getTeamMember, revokeTeamMember } from "@/app/lib/adminMembers";
import { logAdminAction } from "@/app/lib/auditLog";

// Revoke a team member. Main-admin-only, and explicitly refuses to ever
// touch the main admin's own identity — there's no valid input that lets
// this endpoint remove or demote inplayerdigital@gmail.com (or any other
// ADMIN_EMAILS-listed address), which is the whole point of keeping main
// admin status out of this DynamoDB table entirely.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized admin access." }, { status: 401 });
  }

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }

  const member = await getTeamMember(userId);
  if (!member) {
    return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  }
  if (isAdminEmail(member.email)) {
    // Defense in depth — a member row should never be able to carry a main
    // admin's email in the first place, but refuse outright if it somehow did.
    return NextResponse.json({ error: "Cannot revoke the main admin." }, { status: 400 });
  }

  await revokeTeamMember(userId, admin.userId);

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "team_member.revoke",
    targetType: "team_member",
    targetId: userId,
    details: `Revoked ${member.email}`,
  });

  return NextResponse.json({ success: true });
}
