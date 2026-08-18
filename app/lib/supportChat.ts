import { PutCommand, ScanCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import type { SiteDomain } from "@/app/lib/siteDomain";

// ── AI Support Desk: storage layer ──────────────────────────────────────
// One row per support conversation, for BOTH products. `domain` is the
// same "inplayer" | "hammart" | "sponsorship" union the rest of the app
// already uses (app/lib/siteDomain.ts), so the admin panel can slice these
// per-section exactly the way Error Logs and Bug Reports already do — no
// separate table per product, no second convention to keep in sync.
//
// Same tableMissing convention as bugReports.ts: every read/write is
// wrapped so a not-yet-created table degrades to an honest empty state
// instead of throwing a 500 into a customer's chat window. Reno creates
// this table by hand in AWS like every other table in this app.
export const SUPPORT_TICKETS_TABLE = "InPlayer-Support-Tickets"; // PK: ticketId

export type SupportTicketStatus =
  | "ai_resolved"   // the assistant answered and the person confirmed it helped
  | "open"          // needs a human — escalated by the AI or by the person
  | "in_progress"   // an admin has picked it up
  | "resolved"      // a human closed it out
  | "abandoned";    // conversation started, never escalated, never confirmed

/** Who is on the other end — drives which playbook the AI answers from. */
export type SupportRole = "user" | "creator" | "customer" | "vendor";

export type SupportPriority = "low" | "normal" | "high" | "urgent";

export interface SupportMessage {
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface SupportTicket {
  ticketId: string;
  /** "inplayer" or "hammart" — which admin section this shows up under. */
  domain: SiteDomain;
  role: SupportRole;
  userId: string;
  userEmail: string;
  userName: string;
  /** Short AI-written headline so the admin list is scannable. */
  subject: string;
  status: SupportTicketStatus;
  priority: SupportPriority;
  /** Full conversation, oldest first — this IS the report an admin reads. */
  messages: SupportMessage[];
  /** AI's own summary of the problem + what it advised. Written on escalate. */
  aiSummary: string | null;
  /** Why it came to a human, in the AI's words. Null while self-served. */
  escalationReason: string | null;
  pageUrl: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketResult {
  tickets: SupportTicket[];
  tableMissing: boolean;
}

export async function createSupportTicket(
  input: Pick<
    SupportTicket,
    "domain" | "role" | "userId" | "userEmail" | "userName" | "subject" | "pageUrl"
  > & { messages: SupportMessage[] }
): Promise<{ ticketId: string | null; tableMissing?: boolean }> {
  const ticketId = randomUUID();
  const now = new Date().toISOString();
  try {
    await docClient.send(
      new PutCommand({
        TableName: SUPPORT_TICKETS_TABLE,
        Item: {
          ...input,
          ticketId,
          status: "abandoned" satisfies SupportTicketStatus,
          priority: "normal" satisfies SupportPriority,
          aiSummary: null,
          escalationReason: null,
          adminNotes: null,
          createdAt: now,
          updatedAt: now,
        },
      })
    );
    return { ticketId };
  } catch (err) {
    console.error("createSupportTicket: write failed (table may not exist yet):", err);
    return { ticketId: null, tableMissing: true };
  }
}

/**
 * Replaces the stored transcript with the latest one. Deliberately a whole
 * -list overwrite rather than a DynamoDB list_append: the client already
 * holds the authoritative conversation, appending would double up messages
 * on any retry, and a support conversation is far too small for the write
 * size to matter.
 *
 * Best-effort by design — never let a transcript write failure break the
 * reply the person is waiting on.
 */
export async function saveTranscript(
  ticketId: string,
  messages: SupportMessage[],
  patch: Partial<
    Pick<SupportTicket, "status" | "priority" | "aiSummary" | "escalationReason" | "subject">
  > = {}
): Promise<void> {
  // Every attribute name goes through an alias, including the two fixed
  // ones. DynamoDB's reserved-word list is long and grows, and a collision
  // surfaces only at runtime as a ValidationException on a write nobody is
  // watching — aliasing unconditionally costs nothing and removes the whole
  // class of problem.
  const sets: string[] = ["#messages = :m", "#updatedAt = :now"];
  const names: Record<string, string> = {
    "#messages": "messages",
    "#updatedAt": "updatedAt",
  };
  const values: Record<string, unknown> = {
    ":m": messages,
    ":now": new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    // `status` and `priority` are DynamoDB reserved words — alias both.
    const alias = `#${key}`;
    names[alias] = key;
    sets.push(`${alias} = :${key}`);
    values[`:${key}`] = value;
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: SUPPORT_TICKETS_TABLE,
        Key: { ticketId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    );
  } catch (err) {
    console.error("saveTranscript: write failed:", err);
  }
}

export async function getSupportTicket(ticketId: string): Promise<SupportTicket | null> {
  try {
    const result = await docClient.send(
      new GetCommand({ TableName: SUPPORT_TICKETS_TABLE, Key: { ticketId } })
    );
    return (result.Item as SupportTicket) || null;
  } catch (err) {
    console.error("getSupportTicket: read failed:", err);
    return null;
  }
}

/**
 * Admin list, always scoped to ONE domain — an admin looking at the
 * Hammart panel must never see InPlayer creators' conversations and vice
 * versa (the same per-panel isolation Error Logs and Bug Reports follow).
 */
export async function listSupportTickets(
  domain: SiteDomain,
  status?: SupportTicketStatus
): Promise<SupportTicketResult> {
  try {
    const filters = ["#domain = :domain"];
    const names: Record<string, string> = { "#domain": "domain" };
    const values: Record<string, unknown> = { ":domain": domain };

    if (status) {
      filters.push("#status = :status");
      names["#status"] = "status";
      values[":status"] = status;
    }

    const tickets: SupportTicket[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: SUPPORT_TICKETS_TABLE,
          FilterExpression: filters.join(" AND "),
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      tickets.push(...((result.Items || []) as SupportTicket[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    tickets.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return { tickets, tableMissing: false };
  } catch (err) {
    console.error("listSupportTickets: scan failed (table may not exist yet):", err);
    return { tickets: [], tableMissing: true };
  }
}

export async function updateSupportTicketStatus(
  ticketId: string,
  status: SupportTicketStatus,
  adminNotes?: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: SUPPORT_TICKETS_TABLE,
      Key: { ticketId },
      UpdateExpression:
        "SET #status = :status, adminNotes = :notes, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": status,
        ":notes": adminNotes ?? null,
        ":now": new Date().toISOString(),
      },
    })
  );
}
