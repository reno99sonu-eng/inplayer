import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { getInvitation, revokeInvitation } from "@/app/lib/adminInvitations";
import { logAdminAction } from "@/app/lib/auditLog";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized admin access." }, { status: 401 });
  }

  const { invitationId } = await params;
  const invitation = await getInvitation(invitationId);
  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }

  const revoked = await revokeInvitation(invitationId);
  if (!revoked) {
    return NextResponse.json(
      { error: "That invitation was already accepted or revoked." },
      { status: 409 }
    );
  }

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "team_member.invite_revoke",
    targetType: "invitation",
    targetId: invitationId,
    details: `Revoked pending invitation for ${invitation.email}`,
  });

  return NextResponse.json({ success: true });
}
