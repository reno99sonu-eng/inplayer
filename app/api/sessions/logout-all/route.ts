import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { isAdminEmail } from "@/app/lib/isAdmin";
import { revokeAllSessions } from "@/app/lib/sessions";
import { logAdminAction } from "@/app/lib/auditLog";

// POST /api/sessions/logout-all — ends every device's session for your own
// account (Settings > Privacy > "Log out of all devices").
// POST /api/sessions/logout-all with {"userId": "..."} — an ADMIN forcing
// every device of another account to log out (Admin Panel > Users).
export async function POST(request: NextRequest) {
  let caller;
  try {
    caller = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const requestedUserId = typeof body.userId === "string" ? body.userId : null;
  let targetUserId = caller.userId;
  let actingAsAdmin = false;

  if (requestedUserId && requestedUserId !== caller.userId) {
    if (!isAdminEmail(caller.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    targetUserId = requestedUserId;
    actingAsAdmin = true;
  }

  await revokeAllSessions(targetUserId);

  if (actingAsAdmin) {
    await logAdminAction({
      request,
      adminId: caller.userId,
      adminEmail: caller.email as string,
      action: "user.session_revoke_all",
      targetType: "user",
      targetId: targetUserId,
      details: "Force-logged-out every device",
    });
  }

  return NextResponse.json({ success: true });
}
