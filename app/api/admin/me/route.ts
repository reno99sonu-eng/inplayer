import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { isAdminEmail } from "@/app/lib/isAdmin";

// Lets client components (which can't read the server-only ADMIN_EMAILS
// env var directly) find out whether the currently signed-in account is an
// admin, so app/admin/layout.tsx can show the real panel vs. a "not
// authorized" screen. This endpoint only ever reveals whether the CALLER
// themselves is an admin — never the admin list itself.
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    return NextResponse.json({
      isAdmin: isAdminEmail(user.email),
      email: user.email || null,
    });
  } catch {
    return NextResponse.json({ isAdmin: false, email: null });
  }
}
