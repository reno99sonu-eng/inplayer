import { NextRequest } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { createNotification } from "@/app/lib/notifications";
import { logAdminAction } from "@/app/lib/auditLog";

// The real escalating 3-strike AI enforcement system: every time
// app/lib/moderation.ts's moderateText() flags something a real user
// posted (comments, messages, video uploads — see the three call sites in
// app/api/comments/route.ts, app/api/messages/route.ts, and
// app/api/upload/create/route.ts), that call site calls
// applyModerationStrike() right after hiding the flagged content. Strikes
// live directly on the InPlayer-Users row (aiModerationStrikes: Number),
// same "small admin-only counter on the user row" convention the existing
// copyright-strikes system already uses (see app/api/admin/copyright/
// route.ts) — deliberately a SEPARATE counter from copyrightStrikes,
// since a copyright claim and a banned-content violation are different
// things with different admin workflows.
//
//   Strike 1 — a real in-app notification warning. Account untouched.
//   Strike 2 — a real 24-hour account block: suspendedUntil is set, and
//              app/lib/verifyAuth.ts already enforces it sitewide on
//              every signed-in action (uploading, commenting, messaging,
//              liking, etc.) the instant it's set, with no other code
//              changes needed. Auto-lifts itself the moment the timestamp
//              passes — there's no cron job clearing the field, verifyAuth
//              just stops honoring an expired one.
//   Strike 3+ — a real, IMMEDIATE account suspension (isSuspended: true,
//              the exact same flag/enforcement path as an admin's manual
//              suspend or the copyright system's auto-suspend) plus
//              banReviewPending: true, which surfaces the account in
//              Admin Panel -> Moderation -> Strikes (see
//              app/api/admin/moderation/route.ts's "strikes" tab) for a
//              human to confirm or overturn. The suspension takes effect
//              immediately rather than waiting on that review — a
//              three-strike account shouldn't get extra time to keep
//              posting whatever tripped the filter while a human gets
//              around to looking at it — but "permanent" here means "does
//              not auto-expire," not "final and unappealable": an admin
//              can lift it from that same queue (see
//              app/api/admin/moderation/route.ts's POST "lift_ban"
//              action), which resets the strike counter back to 0.
const TEMP_BLOCK_HOURS = 24;
export const AI_STRIKE_TEMP_BLOCK_HOURS = TEMP_BLOCK_HOURS;

export interface ModerationStrikeResult {
  level: 1 | 2 | 3;
  newCount: number;
}

export async function applyModerationStrike(
  request: NextRequest,
  userId: string,
  context: string,
  categories: string[]
): Promise<ModerationStrikeResult> {
  const now = new Date().toISOString();
  const categoryText = categories.length ? ` (flagged for: ${categories.join(", ")})` : "";

  let newCount = 1;
  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Users",
        Key: { userId },
        UpdateExpression: "ADD aiModerationStrikes :one SET updatedAt = :now",
        ExpressionAttributeValues: { ":one": 1, ":now": now },
        ReturnValues: "UPDATED_NEW",
      })
    );
    newCount = Number(result.Attributes?.aiModerationStrikes) || 1;
  } catch (err) {
    console.error(`applyModerationStrike: strike counter update failed for ${userId}:`, err);
  }

  const level = Math.min(newCount, 3) as 1 | 2 | 3;

  try {
    if (level === 1) {
      await createNotification({
        userId,
        type: "admin_announcement",
        message: `Your ${context} was removed for violating InPlayer's content guidelines${categoryText}. This is a warning — a second violation will temporarily block your account, and a third will suspend it.`,
      });
    } else if (level === 2) {
      const suspendedUntil = new Date(Date.now() + TEMP_BLOCK_HOURS * 60 * 60 * 1000).toISOString();
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Users",
          Key: { userId },
          UpdateExpression: "SET suspendedUntil = :until, updatedAt = :now",
          ExpressionAttributeValues: { ":until": suspendedUntil, ":now": now },
        })
      );
      await createNotification({
        userId,
        type: "admin_announcement",
        message: `Your account has been blocked for ${TEMP_BLOCK_HOURS} hours after a second content violation${categoryText}. It unblocks automatically. A third violation will suspend your account.`,
      });
    } else {
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Users",
          Key: { userId },
          UpdateExpression:
            "SET isSuspended = :s, banReviewPending = :p, banReviewReason = :r, updatedAt = :now REMOVE banReviewedAt, banReviewedBy",
          ExpressionAttributeValues: {
            ":s": true,
            ":p": true,
            ":r": `${context}${categoryText}`,
            ":now": now,
          },
        })
      );
      await createNotification({
        userId,
        type: "admin_announcement",
        message: `Your account has been suspended after a third content violation${categoryText}. This is pending admin review.`,
      });
    }
  } catch (err) {
    console.error(`applyModerationStrike: level ${level} action failed for ${userId}:`, err);
  }

  // "system" rather than a real admin identity — this is the automated
  // enforcement pipeline acting on its own, not a human decision. Kept in
  // the same audit trail as manual admin actions (device/location context
  // is still captured from the REQUEST that triggered the strike, i.e.
  // the poster's own request, which is useful signal in its own right)
  // rather than skipped, since "user.ban_strike" already existed in
  // auditLog.ts's AuditAction union unused, clearly meant for this.
  await logAdminAction({
    request,
    adminId: "system",
    adminEmail: "system@inplayer.automated",
    action: "user.ban_strike",
    targetType: "user",
    targetId: userId,
    details: `Strike ${newCount} (level ${level}): ${context}${categoryText}`,
  });

  return { level, newCount };
}
