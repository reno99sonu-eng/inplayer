import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { registerSession } from "@/app/lib/sessions";
import { getRequestIp, getRequestLocation, getRequestDevice } from "@/app/lib/requestInfo";

// Called once, right after a real fresh sign-in (see AuthProvider.tsx) —
// records this device in InPlayer-Sessions so it shows up in Settings >
// Privacy ("where you're logged in") and, for the admin account, in the
// admin panel's own view of active sessions. Every user and vendor account
// goes through this same route, not just admin.
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId, tableMissing } = await registerSession({
    userId: user.userId,
    device: getRequestDevice(request),
    location: getRequestLocation(request),
    ipAddress: getRequestIp(request),
  });

  return NextResponse.json({ sessionId, tableMissing: Boolean(tableMissing) });
}
