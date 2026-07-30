import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { isAdminEmail } from "@/app/lib/isAdmin";
import { revokeSession } from "@/app/lib/sessions";
import { logAdminAction } from "@/app/lib/auditLog";

// DELETE /api/sessions/:sessionId — logs out exactly that one device.
// DELETE /api/sessions/:sessionId?userId=... — an ADMIN forcing a
// specific device of another account to log out (Admin Panel > Users).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  let caller;
  try {
    caller = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedUserId = request.nextUrl.searchParams.get("userId");
  let targetUserId = caller.userId;
  let actingAsAdmin = false;

  if (requestedUserId && requestedUserId !== caller.userId) {
    if (!isAdminEmail(caller.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    targetUserId = requestedUserId;
    actingAsAdmin = true;
  }

  const found = await revokeSession(targetUserId, sessionId);
  if (!found) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (actingAsAdmin) {
    await logAdminAction({
      request,
      adminId: caller.userId,
      adminEmail: caller.email as string,
      action: "user.session_revoke",
      targetType: "user",
      targetId: targetUserId,
      details: `Force-logged-out one device (session ${sessionId})`,
    });
  }

  return NextResponse.json({ success: true });
}
