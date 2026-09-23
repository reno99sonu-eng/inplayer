import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { validateInvitation, markInvitationAccepted } from "@/app/lib/adminInvitations";
import { addTeamMember } from "@/app/lib/adminMembers";
import { logAdminAction } from "@/app/lib/auditLog";

// Redeems an email invitation into an active team-member row. Requires the
// caller to already be signed in as a real InPlayer account (verifyAuth) —
// this is deliberate: it ties the new admin capability to an existing,
// already-verified Cognito identity rather than trusting anything in the
// request body, and validateInvitation additionally requires the
// invitation's target email to match that signed-in account's own email,
// so no one can redeem an invitation addressed to someone else even if the
// link leaked.
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json(
      { error: "Sign in with the invited email address to accept this invitation." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const invitationId = typeof body?.invitationId === "string" ? body.invitationId : "";
  const token = typeof body?.token === "string" ? body.token : "";
  if (!invitationId || !token) {
    return NextResponse.json({ error: "Invalid invitation link." }, { status: 400 });
  }

  const validation = await validateInvitation(invitationId, token, user.email);
  if (!validation.ok) {
    const messages: Record<string, string> = {
      not_found: "This invitation doesn't exist.",
      bad_token: "Invalid invitation link.",
      expired: "This invitation has expired. Ask the main admin to send a new one.",
      already_used: "This invitation has already been used or revoked.",
      email_mismatch:
        "This invitation was sent to a different email address. Sign in with the invited address.",
    };
    return NextResponse.json(
      { error: messages[validation.error] || "This invitation is no longer valid." },
      { status: 400 }
    );
  }

  const { invitation } = validation;

  // Flip pending -> accepted FIRST, atomically (ConditionExpression status
  // = pending). If this fails, someone else already consumed it (a race or
  // a replayed link) — refuse rather than creating a second member row.
  const claimed = await markInvitationAccepted(invitation.invitationId, user.userId);
  if (!claimed) {
    return NextResponse.json(
      { error: "This invitation has already been used." },
      { status: 409 }
    );
  }

  await addTeamMember({
    userId: user.userId,
    email: user.email as string,
    name: user.name || null,
    permissions: invitation.permissions,
    invitedByUserId: invitation.inviterUserId,
    invitedByEmail: invitation.inviterEmail,
    invitationId: invitation.invitationId,
  });

  await logAdminAction({
    request,
    adminId: user.userId,
    adminEmail: user.email as string,
    action: "team_member.accept",
    targetType: "team_member",
    targetId: user.userId,
    details: `Accepted invitation from ${invitation.inviterEmail} with permissions: ${invitation.permissions.join(", ")}`,
  });

  return NextResponse.json({ success: true, permissions: invitation.permissions });
}
