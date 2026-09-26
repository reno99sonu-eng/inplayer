import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, sanitizePermissions } from "@/app/lib/isAdmin";
import { createInvitation } from "@/app/lib/adminInvitations";
import { sendEmail } from "@/app/lib/ses";
import { logAdminAction } from "@/app/lib/auditLog";

export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized admin access." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  const permissions = sanitizePermissions(body.permissions);
  if (permissions.length === 0) {
    return NextResponse.json(
      { error: "Select at least one permission for this team member." },
      { status: 400 }
    );
  }

  let invitation, token;
  try {
    ({ invitation, token } = await createInvitation({
      email,
      permissions,
      inviterUserId: admin.userId,
      inviterEmail: admin.email,
    }));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't create that invitation." },
      { status: 500 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://inplayer.in";
  const acceptUrl = baseUrl + "/team/accept?id=" + encodeURIComponent(invitation.invitationId) + "&token=" + encodeURIComponent(token);

  const permissionList = permissions.map((p) => "\u2022 " + p.replace(/_/g, " ")).join("\n");
  const sent = await sendEmail({
    to: email,
    subject: "You've been invited to the InPlayer admin team",
    text:
      "You've been invited by " + admin.email + " to join the InPlayer admin team with the following permissions:\n\n" +
      permissionList + "\n\n" +
      "Accept this invitation (expires in 7 days, single use):\n" + acceptUrl + "\n\n" +
      "If you weren't expecting this, you can ignore this email.",
    html:
      "<p>You've been invited by <strong>" + admin.email + "</strong> to join the InPlayer admin team with the following permissions:</p>" +
      "<ul>" + permissions.map((p) => "<li>" + p.replace(/_/g, " ") + "</li>").join("") + "</ul>" +
      "<p><a href=\"" + acceptUrl + "\">Accept this invitation</a> (expires in 7 days, single use).</p>" +
      "<p>If you weren't expecting this, you can ignore this email.</p>",
  });

  await logAdminAction({
    request,
    adminId: admin.userId,
    adminEmail: admin.email,
    action: "team_member.invite",
    targetType: "invitation",
    targetId: invitation.invitationId,
    details: "Invited " + email + " with permissions: " + permissions.join(", ") + (sent ? "" : " (email send failed — see server logs)"),
  });

  return NextResponse.json({
    success: true,
    invitationId: invitation.invitationId,
    emailSent: sent,
  });
}
