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
  /** SHA-256 of the raw token — the raw token itself is NEVER stored,
   *  logged, or retrievable after creation; it only ever exists in the one
   *  email sent to the invitee. */
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

/** Creates a pending invitation and returns the ONE-TIME raw token to embed
 *  in the invite email's link — the caller must send it immediately and
 *  never persist it anywhere else; it cannot be recovered from the stored
 *  row afterward. */
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

  await docClient.send(new PutCommand({ TableName: ADMIN_INVITATIONS_TABLE, Item: invitation }));
  return { invitation, token };
}

export async function getInvitation(invitationId: string): Promise<AdminInvitation | null> {
  if (!invitationId) return null;
  const result = await docClient
    .send(new GetCommand({ TableName: ADMIN_INVITATIONS_TABLE, Key: { invitationId } }))
    .catch(() => null);
  return (result?.Item as AdminInvitation | undefined) || null;
}

export async function listInvitations(): Promise<AdminInvitation[]> {
  const result = await docClient.send(new ScanCommand({ TableName: ADMIN_INVITATIONS_TABLE }));
  return ((result.Items || []) as AdminInvitation[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export type InvitationValidationError =
  | "not_found"
  | "bad_token"
  | "expired"
  | "already_used"
  | "email_mismatch";

/** Validates a presented (invitationId, token) pair against the stored
 *  row without mutating anything — checks existence, a timing-safe token
 *  match, expiry, single-use status, and (if provided) that it matches the
 *  signed-in user's own email, so one person can never redeem an
 *  invitation addressed to someone else. */
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

/** Atomically flips a pending invitation to "accepted" — the
 *  ConditionExpression makes this single-use even under a race (two
 *  concurrent accept requests, or a replayed link): only the first
 *  succeeds, every subsequent attempt gets ConditionalCheckFailedException
 *  and must be treated as "already used". Call this BEFORE creating the
 *  team member row, and only proceed to create the row if this succeeds. */
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
