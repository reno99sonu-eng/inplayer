import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import type { TeamPermission } from "@/app/lib/isAdmin";

// Team members are keyed by the accepting user's own Cognito userId — the
// SAME userId every other InPlayer table uses (InPlayer-Users, sessions,
// etc.), so there is never a second identity to reconcile. A row only ever
// gets created by app/api/admin/team/accept's invitation-acceptance flow —
// nothing lets a user write their own row directly, which is what makes
// self-escalation impossible.
export const ADMIN_MEMBERS_TABLE = "InPlayer-Admin-Members";

export interface AdminMember {
  userId: string;
  email: string;
  name: string | null;
  permissions: TeamPermission[];
  invitedByUserId: string;
  invitedByEmail: string;
  invitationId: string;
  addedAt: string;
  status: "active" | "revoked";
  revokedAt: string | null;
  revokedByUserId: string | null;
}

export async function getActiveTeamMember(userId: string): Promise<AdminMember | null> {
  if (!userId) return null;
  const result = await docClient
    .send(new GetCommand({ TableName: ADMIN_MEMBERS_TABLE, Key: { userId } }))
    .catch(() => null);
  const item = result?.Item as AdminMember | undefined;
  if (!item || item.status !== "active") return null;
  return item;
}

export async function getTeamMember(userId: string): Promise<AdminMember | null> {
  if (!userId) return null;
  const result = await docClient
    .send(new GetCommand({ TableName: ADMIN_MEMBERS_TABLE, Key: { userId } }))
    .catch(() => null);
  return (result?.Item as AdminMember | undefined) || null;
}

// Same tableMissing convention as everywhere else in this codebase (see
// app/lib/errorLogs.ts) — Reno creates this table by hand in AWS; until
// then the Team page shows an amber banner with the exact name/key to use
// instead of a raw crash.
export async function listTeamMembers(): Promise<{ members: AdminMember[]; tableMissing: boolean }> {
  try {
    // A small, operator-managed table (a handful of team members at most) —
    // a single bounded Scan is fine, same tradeoff already used elsewhere in
    // this codebase (see app/api/admin/users/route.ts).
    const result = await docClient.send(new ScanCommand({ TableName: ADMIN_MEMBERS_TABLE }));
    const members = ((result.Items || []) as AdminMember[]).sort(
      (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    );
    return { members, tableMissing: false };
  } catch (err) {
    console.error("listTeamMembers: scan failed (table may not exist yet):", err);
    return { members: [], tableMissing: true };
  }
}

export async function addTeamMember(input: {
  userId: string;
  email: string;
  name: string | null;
  permissions: TeamPermission[];
  invitedByUserId: string;
  invitedByEmail: string;
  invitationId: string;
}): Promise<AdminMember> {
  const member: AdminMember = {
    userId: input.userId,
    email: input.email.toLowerCase(),
    name: input.name,
    permissions: input.permissions,
    invitedByUserId: input.invitedByUserId,
    invitedByEmail: input.invitedByEmail,
    invitationId: input.invitationId,
    addedAt: new Date().toISOString(),
    status: "active",
    revokedAt: null,
    revokedByUserId: null,
  };
  try {
    await docClient.send(new PutCommand({ TableName: ADMIN_MEMBERS_TABLE, Item: member }));
  } catch (err) {
    console.error("addTeamMember: write failed (table may not exist yet):", err);
    throw new Error(
      `${ADMIN_MEMBERS_TABLE} hasn't been created in AWS yet — ask the main admin to create it (partition key "userId", String) before invitations can be accepted.`
    );
  }
  return member;
}

/** Sets a member's status to "revoked" — never deletes the row, so the
 *  revocation itself stays a permanent, auditable fact rather than
 *  disappearing. A revoked member's userId can be re-invited later, which
 *  simply overwrites this row via addTeamMember on acceptance. */
export async function revokeTeamMember(userId: string, revokedByUserId: string): Promise<void> {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: ADMIN_MEMBERS_TABLE,
        Key: { userId },
        UpdateExpression: "SET #status = :revoked, revokedAt = :now, revokedByUserId = :by",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":revoked": "revoked",
          ":now": new Date().toISOString(),
          ":by": revokedByUserId,
        },
      })
    );
  } catch (err) {
    console.error("revokeTeamMember: update failed (table may not exist yet):", err);
    throw new Error(`${ADMIN_MEMBERS_TABLE} hasn't been created in AWS yet.`);
  }
}
