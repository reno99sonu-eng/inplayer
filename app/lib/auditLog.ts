import { NextRequest } from "next/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { getRequestIp, getRequestLocation, getRequestDevice } from "@/app/lib/requestInfo";

// One real row per admin decision — who did it, what they did, to what,
// AND where it actually came from — written the moment an admin action
// actually succeeds (never before, and never in place of the real
// action). Same "fire and forget, a logging failure never breaks or fakes
// the real result" convention as app/lib/notifications.ts: if this write
// fails, it's logged to the server console and swallowed, not surfaced to
// the admin as if their suspend/delete/approve click failed when it
// actually went through.
//
// InPlayer only has one admin email (see app/lib/isAdmin.ts), so
// adminEmail alone can't answer "was this really me?" — device/location
// (see app/lib/requestInfo.ts) is the real signal: if the admin account's
// credentials ever leaked, an entry from an unrecognized browser/city is
// the tell.
export const AUDIT_LOGS_TABLE = "InPlayer-Audit-Logs";

export type AuditAction =
  | "user.suspend"
  | "user.unsuspend"
  | "user.delete"
  | "video.delete"
  | "video.restore"
  | "kyc.approve"
  | "kyc.reject"
  | "comment.restore"
  | "comment.delete"
  | "message.restore"
  | "message.delete"
  | "report.resolve"
  | "report.reopen"
  | "notification.broadcast"
  | "settings.update"
  | "copyright.strike"
  | "copyright.dismiss"
  | "copyright.autosuspend"
  | "ad.create"
  | "ad.update"
  | "ad.delete";

export type AuditTargetType =
  | "user"
  | "video"
  | "comment"
  | "message"
  | "report"
  | "notification"
  | "settings"
  | "ad";

interface LogAdminActionInput {
  // The route's own request object — required, not optional, so every
  // single log entry actually carries real device/location context rather
  // than some rows having it and others silently not.
  request: NextRequest;
  adminId: string;
  adminEmail: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  // Extra human-readable context an admin reviewing the log later would
  // want — e.g. a rejection reason, a broadcast's recipient count, or a
  // report's original reason. Optional and free-form on purpose: this is
  // an audit trail, not a query key.
  details?: string;
}

export async function logAdminAction(input: LogAdminActionInput): Promise<void> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: AUDIT_LOGS_TABLE,
        Item: {
          logId: randomUUID(),
          createdAt: new Date().toISOString(),
          adminId: input.adminId,
          adminEmail: input.adminEmail,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          details: input.details || null,
          ipAddress: getRequestIp(input.request),
          location: getRequestLocation(input.request),
          device: getRequestDevice(input.request),
        },
      })
    );
  } catch (err) {
    console.error(`Failed to write audit log for "${input.action}":`, err);
  }
}
