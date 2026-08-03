import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { sendEmail } from "@/app/lib/ses";
import { resolveCognitoEmails } from "@/app/lib/cognitoClient";

interface VideoBroadcastParams {
  videoId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  uploaderId: string;
  uploaderName: string;
  uploaderAvatarUrl?: string;
  contentType?: "video" | "short";
}

/**
 * Broadcasts YouTube-style email notifications to all subscribers of a channel when a new video/short is published.
 */
export async function broadcastNewVideoToSubscribers(params: VideoBroadcastParams): Promise<number> {
  const { videoId, title, description, thumbnailUrl, uploaderId, uploaderName, uploaderAvatarUrl, contentType = "video" } = params;

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

    // 2. Resolve subscriber emails from Cognito
    const emailMap = await resolveCognitoEmails(subscriberUserIds);
    if (emailMap.size === 0) return 0;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://inplayer.app";
    const watchUrl = `${baseUrl}/${contentType === "short" ? "shorts" : "watch"}?v=${videoId}`;
    const subject = `🔴 New ${contentType === "short" ? "Short" : "video"} from ${uploaderName}: "${title}"`;

    let sentCount = 0;

    // 3. Dispatch personalized broadcast emails
    for (const [userId, recipientEmail] of emailMap.entries()) {
      if (!recipientEmail) continue;

      const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b0f19; color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b;">
          <!-- Header / Channel Info -->
          <div style="padding: 20px 24px; background-color: #111827; border-bottom: 1px solid #1f2937; display: flex; align-items: center;">
            ${
              uploaderAvatarUrl
                ? `<img src="${uploaderAvatarUrl}" alt="${uploaderName}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; margin-right: 12px;" />`
                : `<div style="width: 44px; height: 44px; border-radius: 50%; background: #4f46e5; color: #fff; font-weight: bold; line-height: 44px; text-align: center; margin-right: 12px;">${uploaderName.slice(0, 1).toUpperCase()}</div>`
            }
            <div>
              <div style="font-size: 15px; font-weight: 700; color: #f8fafc;">${uploaderName}</div>
              <div style="font-size: 12px; color: #94a3b8;">Uploaded a new ${contentType === "short" ? "Short" : "video"}</div>
            </div>
          </div>

          <!-- Video Thumbnail Card -->
          <div style="padding: 24px;">
            ${
              thumbnailUrl
                ? `<a href="${watchUrl}" target="_blank" style="text-decoration: none;">
                    <img src="${thumbnailUrl}" alt="${title}" style="width: 100%; height: auto; max-height: 320px; object-fit: cover; border-radius: 12px; border: 1px solid #334155;" />
                   </a>`
                : ""
            }

            <h2 style="margin-top: 16px; font-size: 18px; font-weight: 800; color: #ffffff; line-height: 1.4;">
              <a href="${watchUrl}" target="_blank" style="color: #ffffff; text-decoration: none;">${title}</a>
            </h2>

            ${description ? `<p style="font-size: 13px; color: #cbd5e1; line-height: 1.6; margin-top: 8px;">${description.slice(0, 200)}${description.length > 200 ? "..." : ""}</p>` : ""}

            <div style="margin-top: 24px; text-align: center;">
              <a href="${watchUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 100px; text-decoration: none; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                ▶ Watch Now on InPlayer
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 16px 24px; background-color: #090d16; border-top: 1px solid #1e293b; text-align: center; font-size: 11px; color: #64748b;">
            You received this notification because you subscribed to <strong>${uploaderName}</strong> on InPlayer.<br/>
            To change your notification preferences, manage your subscriptions in your InPlayer account settings.
          </div>
        </div>
      `;

      const text = `New video from ${uploaderName}: "${title}"\n\nWatch now: ${watchUrl}\n\nYou received this because you are subscribed to ${uploaderName} on InPlayer.`;

      const success = await sendEmail({ to: recipientEmail, subject, html, text });
      if (success) sentCount++;
    }

    return sentCount;
  } catch (err) {
    console.error("broadcastNewVideoToSubscribers failed:", err);
    return 0;
  }
}

/**
 * Sends welcome subscription email when a user subscribes to a channel.
 */
export async function sendSubscriptionWelcomeEmail(subscriberUserId: string, creatorName: string): Promise<void> {
  try {
    const emailMap = await resolveCognitoEmails([subscriberUserId]);
    const subscriberEmail = emailMap.get(subscriberUserId);
    if (!subscriberEmail) return;

    const subject = `🔔 You are now subscribed to ${creatorName} on InPlayer!`;
    const text = `You are now subscribed to ${creatorName} on InPlayer! You will automatically receive email notifications whenever ${creatorName} uploads a new video or short.`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; background: #0f172a; color: #fff; border-radius: 12px;">
        <h2 style="color: #818cf8;">🔔 Subscribed to ${creatorName}!</h2>
        <p>You'll get instant email updates whenever <strong>${creatorName}</strong> posts a new video, short, or update on InPlayer.</p>
        <p style="color: #94a3b8; font-size: 12px;">Enjoy watching on InPlayer!</p>
      </div>
    `;

    await sendEmail({ to: subscriberEmail, subject, html, text });
  } catch (err) {
    console.error("sendSubscriptionWelcomeEmail failed:", err);
  }
}
