import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { docClient } from "@/app/lib/dynamodb";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import mux from "@/app/lib/mux";
import { CAPTION_TARGETS } from "@/app/lib/captions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { languageCode, vttContent } = await request.json();
    if (!languageCode || !vttContent) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }
    
    if (!vttContent.startsWith("WEBVTT")) {
       return NextResponse.json({ error: "Invalid VTT format" }, { status: 400 });
    }

    const getRes = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId: params.videoId }
      })
    );

    const video = getRes.Item;
    if (!video || video.uploaderId !== auth.userId) {
      return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
    }

    const currentCaptions = video.captionsVtt || {};
    currentCaptions[languageCode] = vttContent;

    // 1. Update DynamoDB
    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId: params.videoId },
        UpdateExpression: "SET captionsVtt = :captions",
        ExpressionAttributeValues: {
          ":captions": currentCaptions
        }
      })
    );

    // 2. Sync to Mux (if it has a muxAssetId)
    if (video.muxAssetId) {
       const origin = request.nextUrl.origin;
       const target = CAPTION_TARGETS.find(t => t.code === languageCode);
       
       if (target) {
          // Delete existing track if any
          const asset = await mux.video.assets.retrieve(video.muxAssetId);
          const existingTrack = asset.tracks?.find(t => t.type === "text" && t.text_type === "subtitles" && t.language_code === languageCode);
          
          if (existingTrack?.id) {
             await mux.video.assets.deleteTrack(video.muxAssetId, existingTrack.id);
          }
          
          // Add new track pointing to our internal endpoint
          await mux.video.assets.createTrack(video.muxAssetId, {
             url: `${origin}/api/videos/${params.videoId}/captions/${languageCode}`,
             type: "text",
             text_type: "subtitles",
             language_code: languageCode,
             name: target.label,
             passthrough: "manual-localization"
          });
       }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Localization sync failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
