import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { isAdminEmail } from "@/app/lib/isAdmin";
import { listSessions } from "@/app/lib/sessions";

// GET /api/sessions — your own active sessions (Settings > Privacy).
// GET /api/sessions?userId=... — an ADMIN looking up another account's
// active sessions (Admin Panel > Users), never usable by a normal user to
// see anyone else's devices/locations.
export async function GET(request: NextRequest) {
  let caller;
  try {
    caller = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedUserId = request.nextUrl.searchParams.get("userId");
  let targetUserId = caller.userId;

  if (requestedUserId && requestedUserId !== caller.userId) {
    if (!isAdminEmail(caller.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    targetUserId = requestedUserId;
  }

  const { sessions, tableMissing } = await listSessions(targetUserId);
  return NextResponse.json({ sessions, tableMissing });
}
