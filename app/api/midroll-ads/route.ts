import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { MIDROLL_ADS_TABLE, MIDROLL_SKIP_TIERS_SECONDS } from "@/app/lib/videoAds";
import { AD_CREATIVES_TABLE } from "@/app/lib/adCreatives";

export async function GET() {
  const settings = await getPlatformSettings();

  // If midrollEnabled setting is explicitly set to false in Admin Panel, return disabled
  if (settings.midrollEnabled === false) {
    return NextResponse.json({ enabled: false, ads: [] });
  }

  try {
    // 1. Dedicated Midroll ads table (filtered strictly for non-empty imageUrl)
    const items: Record<string, unknown>[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await docClient
        .send(
          new ScanCommand({
            TableName: MIDROLL_ADS_TABLE,
            ExclusiveStartKey: exclusiveStartKey,
          })
        )
        .catch(() => null);

      if (result?.Items) {
        items.push(...(result.Items as Record<string, unknown>[]));
      }
      exclusiveStartKey = result?.LastEvaluatedKey;
    } while (exclusiveStartKey);

    let activeItems = items.filter((item) => item && item.active !== false && Boolean(item.imageUrl));
    let isHouseFallback = false;

    // 2. Fallback to House Ad Creatives table (filtered strictly for placement="midroll" or non-empty imageUrl)
    if (activeItems.length === 0) {
      const houseItems: Record<string, unknown>[] = [];
      let houseKey: Record<string, unknown> | undefined;
      do {
        const result = await docClient
          .send(
            new ScanCommand({
              TableName: AD_CREATIVES_TABLE,
              ExclusiveStartKey: houseKey,
            })
          )
          .catch(() => null);

        if (result?.Items) {
          houseItems.push(...(result.Items as Record<string, unknown>[]));
        }
        houseKey = result?.LastEvaluatedKey;
      } while (houseKey);

      // Filter for midroll placement first
      const midrollHouse = houseItems.filter(
        (item) => item && (item.placement === "midroll" || item.placement === "homepage") && item.active !== false && Boolean(item.imageUrl)
      );

      activeItems = midrollHouse.length > 0 ? midrollHouse : houseItems.filter((item) => item && item.active !== false && Boolean(item.imageUrl));
      isHouseFallback = true;
    }

    // Default built-in house mid-roll ad fallback if no valid uploaded ad image is found
    const defaultMidrollAd = [
      {
        adId: "house_pro_midroll",
        imageUrl:
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAwIiBoZWlnaHQ9IjY3NSI+PHJlY3Qgd2lkdGg9IjEyMDAiIGhlaWdodD0iNjc1IiBmaWxsPSIjNEY0NkU1Ii8+PHRleHQgeD0iNjAwIiB5PSIzMDAiIGZvbnQtc2l6ZT0iNDgiIGZpbGw9IiNGRkZGRkYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkluUGxheWVyIFBybyBGaWxtcyAmYW1wOyBPcmlnaW5hbHM8L3RleHQ+PHRleHQgeD0iNjAwIiB5PSIzNzAiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiNGRkZGRkYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPldhdGNoIDRLIEFkLUZyZWUgaW4gMTBwNjA8L3RleHQ+PC9zdmc+",
        linkUrl: "https://inplayer.in/pro",
        title: "InPlayer Pro Pass — Watch 4K Originals & Ad-Free",
      },
    ];

    const formattedAds =
      activeItems.length > 0
        ? activeItems.map((pick) => ({
            adId: String(pick.adId || "midroll_ad"),
            imageUrl: String(pick.imageUrl || ""),
            linkUrl: String(pick.linkUrl || "https://inplayer.in/pro"),
            title: String(pick.title || "InPlayer Special Offer"),
          }))
        : defaultMidrollAd;

    return NextResponse.json({
      enabled: true,
      intervalSeconds: settings.midrollIntervalSeconds || 900, // 15 minutes repeat default
      skipTiersSeconds: MIDROLL_SKIP_TIERS_SECONDS,
      ads: formattedAds,
      ad: formattedAds[0],
      isHouseFallback,
    });
  } catch (err) {
    console.error("Midroll ad lookup failed:", err);
    return NextResponse.json({ enabled: false, ads: [] });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const adId = body?.adId;
  const kind = body?.kind;
  if (!adId || typeof adId !== "string" || (kind !== "click" && kind !== "skip")) {
    return NextResponse.json({ error: "adId and a valid kind are required." }, { status: 400 });
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: MIDROLL_ADS_TABLE,
        Key: { adId },
        UpdateExpression: `ADD ${kind === "click" ? "clicks" : "skips"} :one`,
        ExpressionAttributeValues: { ":one": 1 },
      })
    ).catch(async () => {
      await docClient.send(
        new UpdateCommand({
          TableName: AD_CREATIVES_TABLE,
          Key: { adId },
          UpdateExpression: `ADD ${kind === "click" ? "clicks" : "skips"} :one`,
          ExpressionAttributeValues: { ":one": 1 },
        })
      );
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Midroll ad tracking failed:", err);
    return NextResponse.json({ success: false });
  }
}
