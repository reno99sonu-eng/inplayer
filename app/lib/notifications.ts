import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";
import { isAdminEmail } from "@/app/lib/isAdmin";

// The "like"/"comment"/"subscribe" writers each hand-roll this same
// PutCommand inline (see app/api/likes, app/api/comments,
// app/api/subscriptions) — not touched here to keep this change minimal,
// but every *new* notification type this session adds (message,
// message_request) goes through this one function instead of a fourth
// hand-copy, so those two can never drift from each other the way the
// my-videos CATEGORIES list once drifted from the shared one.
export type NotificationType =
  | "like"
  | "comment"
  | "subscribe"
  | "message"
  | "message_request"
  | "admin_announcement"
  | "live_stream";

interface CreateNotificationInput {
  userId: string; // recipient
  type: NotificationType;
  message: string;
  videoId?: string;
  conversationId?: string;
}

// Failures are swallowed (logged only) — a missing notification should
// never take down the action that triggered it, matching the existing
// try/catch-and-log convention already used at every other notification
// call site in this codebase.
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: "InPlayer-Notifications",
        Item: {
          userId: input.userId,
          notificationId: randomUUID(),
          type: input.type,
          message: input.message,
          read: false,
          createdAt: new Date().toISOString(),
          ...(input.videoId && { videoId: input.videoId }),
          ...(input.conversationId && { conversationId: input.conversationId }),
        },
      })
    );
  } catch (err) {
    console.error(`Failed to write "${input.type}" notification:`, err);
  }
}

/**
 * Notifies all platform admins when an action requires review (e.g. copyright flag).
 */
export async function notifyAdmins(input: { message: string; videoId?: string }): Promise<void> {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Users",
        ProjectionExpression: "userId, email",
      })
    );
    const adminUsers = (result.Items || []).filter((u) => isAdminEmail(u.email as string));
    await Promise.all(
      adminUsers.map((admin) =>
        createNotification({
          userId: admin.userId as string,
          type: "admin_announcement",
          message: input.message,
          ...(input.videoId && { videoId: input.videoId }),
        })
      )
    );
  } catch (err) {
    console.error("Failed to notify admins:", err);
  }
}
