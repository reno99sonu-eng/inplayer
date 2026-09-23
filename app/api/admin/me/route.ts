import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
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
  } catch {
    return NextResponse.json({ isAdmin: false, isMainAdmin: false, email: null, permissions: [] });
  }
}
