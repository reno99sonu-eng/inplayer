import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { AD_CREATIVES_TABLE, AdPlacement } from "@/app/lib/adCreatives";

const VALID_PLACEMENTS: AdPlacement[] = ["homepage", "watch", "homepage_spotlight", "weekly_featured"];

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

    const activeItems = items.filter((item) => item.active !== false);

    // STRICT ISOLATION: Only return creatives created EXCLUSIVELY for this placement.
    // Never fall back to mixing ads from other placements.
    const matching = activeItems.filter((item) => item.placement === placement && Boolean(item.imageUrl));

    if (matching.length === 0) {
      return NextResponse.json({ source: "off" });
    }

    const formattedCreatives = matching.map((pick) => ({
      adId: String(pick.adId),
      imageUrl: String(pick.imageUrl || ""),
      linkUrl: String(pick.linkUrl || "#"),
      title: String(pick.title || "Advertisement"),
    }));

    // Record impression for the first delivered item asynchronously
    const deliveredItem = matching[0];
    if (deliveredItem?.adId) {
      docClient
        .send(
          new UpdateCommand({
            TableName: AD_CREATIVES_TABLE,
            Key: { adId: deliveredItem.adId },
            UpdateExpression: "ADD impressions :inc",
            ExpressionAttributeValues: { ":inc": 1 },
          })
        )
        .catch(() => null);
    }

    return NextResponse.json({
      source: "house",
      creatives: formattedCreatives,
      creative: formattedCreatives[0],
    });
  } catch (err) {
    console.error("Failed to fetch ad creative:", err);
    return NextResponse.json({ source: "off" });
  }
}
