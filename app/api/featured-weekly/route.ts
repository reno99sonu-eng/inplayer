import { NextResponse } from "next/server";
import { getFeaturedThisWeek } from "@/app/lib/trendingStore";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { docClient } from "@/app/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { AD_CREATIVES_TABLE } from "@/app/lib/adCreatives";

export async function GET() {
  const settings = await getPlatformSettings();

  if (settings.weeklyFeaturedEnabled === false) {
    return NextResponse.json({ videos: [], banners: [], enabled: false });
  }

  const videos = await getFeaturedThisWeek(6);

  // Fetch active weekly_featured ad banners if uploaded
  let banners: Record<string, unknown>[] = [];
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: AD_CREATIVES_TABLE,
        FilterExpression: "placement = :p AND active = :act",
        ExpressionAttributeValues: { ":p": "weekly_featured", ":act": true },
      })
    ).catch(() => null);
    if (result?.Items) {
      banners = result.Items as Record<string, unknown>[];
    }
  } catch (err) {
    console.error("Failed to fetch weekly_featured ad banners:", err);
  }

  return NextResponse.json({ videos, banners, enabled: true });
}
