import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { AD_CREATIVES_TABLE, AdPlacement } from "@/app/lib/adCreatives";

const VALID_PLACEMENTS: AdPlacement[] = ["homepage", "watch", "homepage_spotlight"];

export async function GET(request: NextRequest) {
  const placement = request.nextUrl.searchParams.get("placement") as AdPlacement | null;
  if (!placement || !VALID_PLACEMENTS.includes(placement)) {
    return NextResponse.json({ error: "Invalid placement." }, { status: 400 });
  }

  const settings = await getPlatformSettings();
  const source =
    placement === "homepage"
      ? settings.homepageBannerSource
      : placement === "watch"
      ? settings.watchPageBannerSource
      : settings.homepageSpotlightSource;

  if (source === "adsense") {
    if (settings.adsenseEnabled && settings.adsensePublisherId) {
      return NextResponse.json({ source: "adsense", adsensePublisherId: settings.adsensePublisherId });
    }
  }

  // House ad handling: Scan house ad creatives
  try {
    const items: Record<string, unknown>[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: AD_CREATIVES_TABLE,
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      items.push(...((result.Items || []) as Record<string, unknown>[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    // Filter active items
    const activeItems = items.filter((item) => item.active !== false);

    if (activeItems.length === 0) {
      return NextResponse.json({ source: "off" });
    }

    // Try exact placement match first
    let matching = activeItems.filter((item) => item.placement === placement);

    // Fallback: If no exact placement match, pick any active creative
    if (matching.length === 0) {
      matching = activeItems;
    }

    const pick = matching[Math.floor(Math.random() * matching.length)];

    // Fire impression tracking best-effort
    if (pick.adId) {
      docClient
        .send(
          new UpdateCommand({
            TableName: AD_CREATIVES_TABLE,
            Key: { adId: pick.adId },
            UpdateExpression: "ADD impressions :one",
            ExpressionAttributeValues: { ":one": 1 },
          })
        )
        .catch((err) => console.error("ads: impression counter failed:", err));
    }

    return NextResponse.json({
      source: "house",
      creative: {
        adId: pick.adId,
        imageUrl: pick.imageUrl,
        linkUrl: pick.linkUrl,
        title: pick.title,
      },
    });
  } catch (err) {
    console.error("Ad creatives lookup failed:", err);
    return NextResponse.json({ source: "off" });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const adId = body?.adId;
  if (!adId || typeof adId !== "string") {
    return NextResponse.json({ error: "adId is required." }, { status: 400 });
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: AD_CREATIVES_TABLE,
        Key: { adId },
        UpdateExpression: "ADD clicks :one",
        ExpressionAttributeValues: { ":one": 1 },
      })
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Ad click tracking failed:", err);
    return NextResponse.json({ success: false });
  }
}
