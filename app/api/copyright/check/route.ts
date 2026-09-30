import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { screenVideoUpload, VIDEO_COPYRIGHT_REPORTER } from "@/app/lib/videoCopyright";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { randomUUID } from "crypto";
import { createNotification, notifyAdmins } from "@/app/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    
    const { videoId, sha256, title, description, tags, contentType } = body;
    
    if (!videoId || !title) {
      return NextResponse.json({ error: "videoId and title are required" }, { status: 400 });
    }

    const { risk, signals, duplicateVideoId, originalCreatorId } = await screenVideoUpload({
      uploadingCreatorId: user.userId,
      sha256,
      title,
      description,
      tags,
    });

    let reportId: string | undefined;

    if (risk === "review" || risk === "definite") {
      reportId = randomUUID();
      const createdAt = new Date().toISOString();

      await docClient.send(
        new PutCommand({
          TableName: "InPlayer-Copyright-Reports",
          Item: {
            reportId,
            videoId,
            reportedCreatorId: user.userId,
            reporterId: VIDEO_COPYRIGHT_REPORTER,
            risk,
            signals: JSON.stringify(signals),
            status: "pending",
            createdAt,
            ...(duplicateVideoId && { duplicateVideoId }),
          },
        })
      );

      if (originalCreatorId) {
        await createNotification({
          userId: originalCreatorId,
          type: "copyright",
          message: `⚠️ Your content may have been copied. Video ID: ${videoId} has been flagged for review.`,
        });
      }

      await notifyAdmins({
        message: `🚨 Copyright flag on video ${videoId} — risk: ${risk}. Uploaded by: ${user.userId}`,
        videoId,
      });
    }

    return NextResponse.json({ risk, signals, reportId });
  } catch (err) {
    console.error("Video copyright check failed:", err);
    // Never block upload based on copyright check API failure
    return NextResponse.json({ risk: "clear", signals: [] });
  }
}
