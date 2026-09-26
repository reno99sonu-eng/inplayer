import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { listInvitations } from "@/app/lib/adminInvitations";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized admin access." }, { status: 401 });
  }

  const { invitations, tableMissing } = await listInvitations();
  // Never return tokenHash — nothing outside adminInvitations.ts needs it,
  // and there's no reason to put even a hash of a security token over the
  // wire to the browser.
  const safe = invitations.map((inv) => ({
    invitationId: inv.invitationId,
    email: inv.email,
    permissions: inv.permissions,
    inviterUserId: inv.inviterUserId,
    inviterEmail: inv.inviterEmail,
    createdAt: inv.createdAt,
    expiresAt: inv.expiresAt,
    status: inv.status,
    acceptedAt: inv.acceptedAt,
    acceptedUserId: inv.acceptedUserId,
  }));
  return NextResponse.json({ invitations: safe, tableMissing });
}
