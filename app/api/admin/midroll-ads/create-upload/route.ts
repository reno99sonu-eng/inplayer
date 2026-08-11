import { NextRequest, NextResponse } from "next/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import mux from "@/app/lib/mux";
import { docClient } from "@/app/lib/dynamodb";
import { requireAdmin } from "@/app/lib/isAdmin";
import { MIDROLL_ADS_TABLE } from "@/app/lib/videoAds";
import { logAdminAction } from "@/app/lib/auditLog";

export async function POST(request: NextRequest) {
  let admin;

  try {
    admin = await requireAdmin(request);
  } catch {
    return NextResponse.json(
      { error: "Please sign in as admin to upload." },
      { status: 401 }
    );
  }
  
  try {
    const body = await request.json();
    const { title, linkUrl } = body;

    if (!title?.trim() || !linkUrl?.trim()) {
      return NextResponse.json(
        { error: "Title and link URL are required." },
        { status: 400 }
      );
    }

    const upload = await mux.video.uploads.create({
      cors_origin: "*", 
      new_asset_settings: {
        playback_policy: ["public"],
      },
    });

    const adId = upload.id;

    await docClient.send(
      new PutCommand({
        TableName: MIDROLL_ADS_TABLE,
        Item: {
          adId,
          status: "processing", 
          title: title.trim().slice(0, 120),
          linkUrl: linkUrl.trim().slice(0, 500),
          imageUrl: "", 
          active: true,
          createdAt: new Date().toISOString(),
          impressions: 0,
          clicks: 0,
          skips: 0,
        },
      })
    );

    await logAdminAction({
      request,
      adminId: admin.userId,
      adminEmail: admin.email,
      action: "midroll_ad.create",
      targetType: "midroll_ad",
      targetId: adId,
      details: title.trim().slice(0, 120),
    });

    return NextResponse.json({
      uploadUrl: upload.url,
      adId,
    });
  } catch (error) {
    console.error("Failed to create Mux upload for midroll ad:", error);
    return NextResponse.json(
      { error: "Failed to initialize upload." },
      { status: 500 }
    );
  }
}
