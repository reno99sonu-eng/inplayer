import { NextRequest } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getActiveTeamMember } from "@/app/lib/adminMembers";

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
// signed-in MAIN admin — callers should catch and respond 401. Deliberately
// UNCHANGED behavior (main-admin-only) even after team members were added:
// this stays the "full, unrestricted admin" gate every pre-existing route
// already uses, so none of them silently start accepting a limited team
// member just because RBAC was introduced elsewhere. New, explicitly
// whitelisted routes use requirePermission() below instead.
export async function requireAdmin(request: NextRequest): Promise<AdminUser> {
  const user = await verifyAuth(request); // throws if not signed in at all
  if (!isAdminEmail(user.email)) {
    throw new Error("Not authorized as admin");
  }
  return { userId: user.userId, email: user.email as string, name: user.name };
}

// ── Team-member RBAC ─────────────────────────────────────────────────
//
// A team member is NOT a second kind of full admin — they're a signed-in
// user with a specific, main-admin-issued grant of one or more of these
// closed capabilities, recorded in InPlayer-Admin-Members (see
// app/lib/adminMembers.ts) and reachable only by accepting an email
// invitation from the main admin (app/lib/adminInvitations.ts). A team
// member can never grant itself a permission, invite another member, or
// touch anything not explicitly listed here.
export const TEAM_PERMISSIONS = [
  "view_reports",
  "view_support",
  "view_bugs",
  "view_errors",
  "manage_navbar_theme",
  "manage_ads",
  "delete_stuck_processing_videos",
] as const;

export type TeamPermission = (typeof TEAM_PERMISSIONS)[number];

export function isTeamPermission(raw: unknown): raw is TeamPermission {
  return typeof raw === "string" && (TEAM_PERMISSIONS as readonly string[]).includes(raw);
}

/** Sanitises a client-supplied permission list down to only real,
 *  recognised permissions — anything else is silently dropped rather than
 *  stored, so a hand-made invite request can never smuggle in a made-up or
 *  future-reserved capability string. */
export function sanitizePermissions(raw: unknown): TeamPermission[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<TeamPermission>();
  for (const entry of raw) {
    if (isTeamPermission(entry)) unique.add(entry);
  }
  return Array.from(unique);
}

export interface AdminIdentity {
  userId: string;
  email: string;
  name?: string;
  /** True only for an email in the hardcoded/ADMIN_EMAILS list — full,
   *  unrestricted access, identical to what requireAdmin() has always
   *  granted. Every other authorized caller is a team member. */
  isMainAdmin: boolean;
  permissions: Set<TeamPermission>;
}

/** Resolves whichever kind of authorized admin identity the caller is —
 *  main admin (full access) or an active team member (only their granted
 *  permissions) — or throws if neither. This is the ONLY place that reads
 *  InPlayer-Admin-Members to make an authorization decision. */
export async function getAdminIdentity(request: NextRequest): Promise<AdminIdentity> {
  const user = await verifyAuth(request);

  if (isAdminEmail(user.email)) {
    return {
      userId: user.userId,
      email: user.email as string,
      name: user.name,
      isMainAdmin: true,
      permissions: new Set(TEAM_PERMISSIONS),
    };
  }

  const member = await getActiveTeamMember(user.userId);
  if (member) {
    return {
      userId: user.userId,
      email: user.email as string,
      name: user.name,
      isMainAdmin: false,
      permissions: new Set(member.permissions),
    };
  }

  throw new Error("Not authorized as admin");
}

/** Call at the top of a route that a team member with the given permission
 *  should also be able to reach. Main admins always pass. Throws (callers
 *  should respond 401/403) for anyone else, including a signed-in team
 *  member who lacks this specific permission — permission checks are never
 *  satisfied client-side. */
export async function requirePermission(
  request: NextRequest,
  permission: TeamPermission
): Promise<AdminIdentity> {
  const identity = await getAdminIdentity(request);
  if (!identity.isMainAdmin && !identity.permissions.has(permission)) {
    throw new Error(`Forbidden: missing permission "${permission}"`);
  }
  return identity;
}
