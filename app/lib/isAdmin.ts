import { NextRequest } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";

// Single source of truth for "who is allowed into the Admin Panel and any
// admin-only maintenance tool" (the Admin Panel itself, plus the
// already-existing /admin/captions repair tool at app/api/admin/recaption).
//
// Two ways an email lands here, so nothing is ever blocked on a missing env
// var:
//   1. The hardcoded fallback below — this is the same email
//      app/api/admin/recaption already trusted before the Admin Panel
//      existed, so nothing that already worked stops working.
//   2. The ADMIN_EMAILS environment variable (comma-separated, e.g.
//      "owner@example.com, manager@example.com") — set this in Vercel
//      under Project -> Settings -> Environment Variables to add or swap
//      admin accounts WITHOUT a code change or a new deploy.
const HARDCODED_ADMIN_EMAILS = [
  "reno99sonu@gmail.com",
  "inplayerdigital@gmail.com",
];

function adminEmailList(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(
    new Set([
      ...HARDCODED_ADMIN_EMAILS.map((e) => e.toLowerCase()),
      ...fromEnv,
    ])
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmailList().includes(email.toLowerCase());
}

export interface AdminUser {
  userId: string;
  email: string;
  name?: string;
}

// Call at the top of any /api/admin/* route. Throws if the caller isn't a
// signed-in admin — callers should catch and respond 401.
export async function requireAdmin(request: NextRequest): Promise<AdminUser> {
  const user = await verifyAuth(request); // throws if not signed in at all
  if (!isAdminEmail(user.email)) {
    throw new Error("Not authorized as admin");
  }
  return { userId: user.userId, email: user.email as string, name: user.name };
}
