import { NextRequest, NextResponse } from "next/server";
import { IvsClient, CreateChannelCommand } from "@aws-sdk/client-ivs";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { docClient } from "@/app/lib/dynamodb";
import { PutCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { createNotification } from "@/app/lib/notifications";
import { broadcastLiveStreamToSubscribers } from "@/app/lib/subscriptionBroadcast";
import { moderateText, UNCHECKED } from "@/app/lib/moderation";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { applyModerationStrike } from "@/app/lib/moderationStrikes";

const ivsClient = new IvsClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const { title, description, visibility, commentsEnabled } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    
    // Check moderation
    const platformSettings = await getPlatformSettings();
    const uploadModeration = platformSettings.moderationEnabledUploads
      ? await moderateText(`${title} ${description || ""}`)
      : UNCHECKED;
    const moderationHidden = uploadModeration.checked && uploadModeration.flagged;

    if (moderationHidden) {
      await applyModerationStrike(
        request,
        user.userId,
        "live stream",
        uploadModeration.categories
      ).catch((err) => console.error("ivs-create: applyModerationStrike failed:", err));
    }

    // Get user avatar
    const profileResult = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Users",
        Key: { userId: user.userId },
      })
    );
    const uploaderAvatarUrl = profileResult.Item?.avatarUrl || null;
    const uploaderName = user.name || "Unknown";
    
    // Create an IVS channel
    const channelName = `live-stream-${user.userId}-${Date.now()}`;
    const command = new CreateChannelCommand({
      name: channelName,
      latencyMode: "LOW",
      type: "STANDARD",
      insecureIngest: false,
      authorized: false,
      // Attaching a Recording Configuration is what makes IVS auto-record
      // this channel's streams to S3 — the first half of turning a finished
      // livestream into a real, permanently-watchable video afterward (see
      // app/api/webhooks/ivs-recording/route.ts for the rest of that
      // pipeline, and app/api/live/end/route.ts for why, without this, a
      // stream that ends just sits on a "processing" status forever with
      // nothing left to convert). Left out entirely when the env var isn't
      // set — same as before this change, live streaming itself is
      // completely unaffected either way, only auto-VOD is gated on it.
      ...(process.env.IVS_RECORDING_CONFIG_ARN
        ? { recordingConfigurationArn: process.env.IVS_RECORDING_CONFIG_ARN }
        : {}),
    });

    const response = await ivsClient.send(command);

    if (!response.channel || !response.streamKey) {
      throw new Error("Failed to create IVS channel");
    }
    
    const channelArn = response.channel.arn!;
    const videoId = channelName;

    // Save to InPlayer-Videos
    await docClient.send(
      new PutCommand({
        TableName: "InPlayer-Videos",
        Item: {
          videoId,
          status: "live",
          title: title.trim(),
          description: description?.trim() || "",
          category: "Live",
          contentType: "video",
          uploaderId: user.userId,
          uploaderName,
          uploaderAvatarUrl,
          uploadedAt: new Date().toISOString(),
          views: 0,
          visibility: ["public", "unlisted", "private"].includes(visibility) ? visibility : "public",
          commentsEnabled: commentsEnabled !== false,
          ivsChannelArn: channelArn,
          ivsPlaybackUrl: response.channel.playbackUrl,
          ...(moderationHidden && {
            flagged: true,
            flaggedCategories: uploadModeration.categories,
            moderationHidden: true,
            moderatedAt: new Date().toISOString(),
          }),
        },
      })
    );

    // Trigger Notifications
    if (!moderationHidden && visibility === "public") {
      void broadcastLiveStreamToSubscribers({
        videoId,
        title,
        description,
        uploaderId: user.userId,
        uploaderName,
        uploaderAvatarUrl,
      });

      // Send in-app notifications to subscribers
      try {
        const subsResult = await docClient.send(
          new QueryCommand({
            TableName: "InPlayer-Subscriptions",
            IndexName: "creatorId-index",
            KeyConditionExpression: "creatorId = :creatorId",
            ExpressionAttributeValues: {
              ":creatorId": user.userId,
            },
          })
        );
        const subscribers = subsResult.Items || [];
        for (const sub of subscribers) {
          if (sub.notifyEnabled !== false) {
            void createNotification({
              userId: sub.subscriberId,
              type: "live_stream",
              message: `${uploaderName} is live: ${title}`,
              videoId,
            });
          }
        }
      } catch (e) {
        console.error("Failed to send in-app notifications:", e);
      }
    }

    return NextResponse.json({
      videoId,
      ingestEndpoint: response.channel.ingestEndpoint,
      streamKey: response.streamKey.value,
      playbackUrl: response.channel.playbackUrl,
      channelArn,
    });
  } catch (err) {
    console.error("Failed to create IVS channel:", err);
    return NextResponse.json(
      { error: "Couldn't initialize live stream." },
      { status: 500 }
    );
  }
}
