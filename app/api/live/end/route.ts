import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

export async function POST(req: NextRequest) {
  try {
    const { videoId } = await req.json();

    if (!videoId) {
      return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
    }

    const user = await verifyAuth(req);
    const userSub = user.userId;
    if (!userSub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First check if the user actually owns this live stream
    const getRes = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId },
      })
    );

    const video = getRes.Item;
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.uploaderId !== userSub) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // In a full production setup with IVS Auto-Recording to S3, EventBridge 
    // would trigger a Lambda when the recording is ready and update this. 
    // Here we will transition the status so it shows up as a VOD. 
    // Since we don't have the final S3 path synchronously, we set it to 'processing'
    // or if we just want it to appear as an empty VOD for now, we can set 'ready'
    // but the IVS live URL won't work for VOD. We will set it to 'processing' 
    // so the WatchPage knows it's being converted/recorded.

    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId },
        UpdateExpression: "SET #st = :status",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":status": "processing" },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to end live stream:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
