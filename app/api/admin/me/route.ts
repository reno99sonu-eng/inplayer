import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, SESSION_REVOKED_MESSAGE } from "@/app/lib/verifyAuth";
import { isAdminEmail } from "@/app/lib/isAdmin";
import { getActiveTeamMember } from "@/app/lib/adminMembers";

// Lets client components (which can't read the server-only ADMIN_EMAILS
// env var directly, nor query InPlayer-Admin-Members) find out whether the
// currently signed-in account is authorized into the Admin Panel at all —
// as the main admin OR as an active team member — so app/admin/layout.tsx
// can show the real panel vs. a "not authorized" screen, and so the
// sidebar/pages can show only what this identity is actually permitted to
// use. This endpoint only ever reveals the CALLER's own access — never the
// admin/team list itself. It is informational only: every real permission
// decision is still re-checked server-side by requireAdmin()/
// requirePermission() on the specific route being called.
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);

    if (isAdminEmail(user.email)) {
      return NextResponse.json({
        isAdmin: true,
        isMainAdmin: true,
        email: user.email || null,
        permissions: [],
      });
    }

    const member = await getActiveTeamMember(user.userId);
    if (member) {
      return NextResponse.json({
        isAdmin: true,
        isMainAdmin: false,
        email: user.email || null,
        permissions: member.permissions,
      });
    }

    return NextResponse.json({ isAdmin: false, isMainAdmin: false, email: user.email || null, permissions: [] });
  } catch (err) {
    // This device's session was ended (log out of this/all devices, or the
    // device cap evicted it) while its Cognito token is still valid. Every
    // admin data request from it is rejected, so say so distinctly — the
    // layout then shows "sign in again" instead of letting each page fail
    // with a bare "Unauthorized".
    if (err instanceof Error && err.message === SESSION_REVOKED_MESSAGE) {
      return NextResponse.json(
        {
          isAdmin: false,
          isMainAdmin: false,
          email: null,
          permissions: [],
          code: "SESSION_REVOKED",
        },
        { status: 401 }
      );
    }
    return NextResponse.json({ isAdmin: false, isMainAdmin: false, email: null, permissions: [] });
  }
}
