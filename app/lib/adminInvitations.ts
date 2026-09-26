import { randomBytes, randomUUID, createHash, timingSafeEqual } from "crypto";
import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import type { TeamPermission } from "@/app/lib/isAdmin";

// Email-only team-member invitations. THIS IS THE ONLY WAY a team member
// account can ever come into existence — there is no self-enrollment, no
// copy/share link, and no way for an existing user to toggle their own
// role. Only the main admin can call createInvitation (see
// app/api/admin/team/invite/route.ts), and only the invited email address,
// once signed in, can redeem it (see app/api/admin/team/accept/route.ts).
export const ADMIN_INVITATIONS_TABLE = "InPlayer-Admin-Invitations";

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AdminInvitation {
  invitationId: string;
  email: string;
  tokenHash: string;
  permissions: TeamPermission[];
  inviterUserId: string;
  inviterEmail: string;
  createdAt: string;
  expiresAt: string;
  status: "pending" | "accepted" | "revoked";
  acceptedAt: string | null;
  acceptedUserId: string | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createInvitation(input: {
  email: string;
  permissions: TeamPermission[];
  inviterUserId: string;
  inviterEmail: string;
}): Promise<{ invitation: AdminInvitation; token: string }> {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const invitation: AdminInvitation = {
    invitationId: randomUUID(),
    email: input.email.toLowerCase(),
    tokenHash: hashToken(token),
    permissions: input.permissions,
    inviterUserId: input.inviterUserId,
    inviterEmail: input.inviterEmail,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + INVITATION_TTL_MS).toISOString(),
    status: "pending",
    acceptedAt: null,
    acceptedUserId: null,
  };

  try {
    await docClient.send(new PutCommand({ TableName: ADMIN_INVITATIONS_TABLE, Item: invitation }));
  } catch (err) {
    console.error("createInvitation: write failed (table may not exist yet):", err);
    throw new Error(
      ADMIN_INVITATIONS_TABLE + " hasn't been created in AWS yet — create a DynamoDB table with that name (partition key \"invitationId\", String) before sending invitations."
    );
  }
  return { invitation, token };
}

export async function getInvitation(invitationId: string): Promise<AdminInvitation | null> {
  if (!invitationId) return null;
  const result = await docClient
    .send(new GetCommand({ TableName: ADMIN_INVITATIONS_TABLE, Key: { invitationId } }))
    .catch(() => null);
  return (result?.Item as AdminInvitation | undefined) || null;
}

export async function listInvitations(): Promise<{ invitations: AdminInvitation[]; tableMissing: boolean }> {
  try {
    const result = await docClient.send(new ScanCommand({ TableName: ADMIN_INVITATIONS_TABLE }));
    const invitations = ((result.Items || []) as AdminInvitation[]).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return { invitations, tableMissing: false };
  } catch (err) {
    console.error("listInvitations: scan failed (table may not exist yet):", err);
    return { invitations: [], tableMissing: true };
  }
}

export type InvitationValidationError =
  | "not_found"
  | "bad_token"
  | "expired"
  | "already_used"
  | "email_mismatch";

export async function validateInvitation(
  invitationId: string,
  token: string,
  expectedEmail?: string
): Promise<{ ok: true; invitation: AdminInvitation } | { ok: false; error: InvitationValidationError }> {
  const invitation = await getInvitation(invitationId);
  if (!invitation) return { ok: false, error: "not_found" };

  const presented = Buffer.from(hashToken(token), "hex");
  const stored = Buffer.from(invitation.tokenHash, "hex");
  const tokenMatches =
    presented.length === stored.length && timingSafeEqual(presented, stored);
  if (!tokenMatches) return { ok: false, error: "bad_token" };

  if (invitation.status !== "pending") return { ok: false, error: "already_used" };
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return { ok: false, error: "expired" };

  if (expectedEmail && invitation.email !== expectedEmail.toLowerCase()) {
    return { ok: false, error: "email_mismatch" };
  }

  return { ok: true, invitation };
}

export async function markInvitationAccepted(
  invitationId: string,
  acceptedUserId: string
): Promise<boolean> {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: ADMIN_INVITATIONS_TABLE,
        Key: { invitationId },
        UpdateExpression: "SET #status = :accepted, acceptedAt = :now, acceptedUserId = :userId",
        ConditionExpression: "#status = :pending",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":accepted": "accepted",
          ":pending": "pending",
          ":now": new Date().toISOString(),
          ":userId": acceptedUserId,
        },
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function revokeInvitation(invitationId: string): Promise<boolean> {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: ADMIN_INVITATIONS_TABLE,
        Key: { invitationId },
        UpdateExpression: "SET #status = :revoked",
        ConditionExpression: "#status = :pending",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":revoked": "revoked", ":pending": "pending" },
      })
    );
    return true;
  } catch {
    return false;
  }
}
