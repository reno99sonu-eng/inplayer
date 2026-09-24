import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { createNotification } from "@/app/lib/notifications";

interface VideoBroadcastParams {
  videoId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  uploaderId: string;
  uploaderName: string;
  uploaderAvatarUrl?: string;
  contentType?: "video" | "short" | "music";
}

/**
 * Notifies all subscribers of a channel (bell icon only, no email) when a new video/short/track is published.
 */
export async function broadcastNewVideoToSubscribers(params: VideoBroadcastParams): Promise<number> {
  const { videoId, title, uploaderId, uploaderName, contentType = "video" } = params;

  // "Short" / "video" / "track" — a song announced as a "new video" reads
  // as a mistake to the person who gets the notification.
  const noun =
    contentType === "short" ? "Short" : contentType === "music" ? "track" : "video";

  try {
    // 1. Query all subscribers of the creator from InPlayer-Subscriptions GSI (creatorId-index)
    const subsResult = await docClient.send(
      new QueryCommand({
        TableName: "InPlayer-Subscriptions",
        IndexName: "creatorId-index",
        KeyConditionExpression: "creatorId = :creatorId",
        ExpressionAttributeValues: {
          ":creatorId": uploaderId,
        },
      })
    ).catch(() => null);

    const subscribers = subsResult?.Items || [];
    if (subscribers.length === 0) return 0;

    // Filter subscribers with notifications enabled (defaults to true)
    const activeSubscribers = subscribers.filter((sub) => sub.notifyEnabled !== false);
    const subscriberUserIds = activeSubscribers.map((sub) => sub.subscriberId);
    if (subscriberUserIds.length === 0) return 0;

    // 2. Dispatch in-app (bell icon) notifications for all active subscribers in InPlayer-Notifications
    const inAppMessage = `${uploaderName} uploaded a new ${noun}: "${title}"`;
    await Promise.allSettled(
      subscriberUserIds.map((subscriberId) =>
        createNotification({
          userId: subscriberId,
          type: "video_upload",
          message: inAppMessage,
          videoId,
        })
      )
    );

    return subscriberUserIds.length;
  } catch (err) {
    console.error("broadcastNewVideoToSubscribers failed:", err);
    return 0;
  }
}

/**
 * Notifies all subscribers of a channel (bell icon only, no email) when they go live.
 */
export async function broadcastLiveStreamToSubscribers(params: Omit<VideoBroadcastParams, "contentType">): Promise<number> {
  const { videoId, title, uploaderId, uploaderName } = params;

  try {
    // 1. Query all subscribers of the creator from InPlayer-Subscriptions GSI (creatorId-index)
    const subsResult = await docClient.send(
      new QueryCommand({
        TableName: "InPlayer-Subscriptions",
        IndexName: "creatorId-index",
        KeyConditionExpression: "creatorId = :creatorId",
        ExpressionAttributeValues: {
          ":creatorId": uploaderId,
        },
      })
    ).catch(() => null);

    const subscribers = subsResult?.Items || [];
    if (subscribers.length === 0) return 0;

    // Filter subscribers with notifications enabled (defaults to true)
    const activeSubscribers = subscribers.filter((sub) => sub.notifyEnabled !== false);
    const subscriberUserIds = activeSubscribers.map((sub) => sub.subscriberId);
    if (subscriberUserIds.length === 0) return 0;

    // 2. Dispatch in-app (bell icon) notifications for all active subscribers in InPlayer-Notifications
    const liveNotifMessage = `🔴 ${uploaderName} is live: "${title}"`;
    await Promise.allSettled(
      subscriberUserIds.map((subscriberId) =>
        createNotification({
          userId: subscriberId,
          type: "live_stream",
          message: liveNotifMessage,
          videoId,
        })
      )
    );

    return subscriberUserIds.length;
  } catch (err) {
    console.error("broadcastLiveStreamToSubscribers failed:", err);
    return 0;
  }
}
