import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { MIDROLL_ADS_TABLE, MIDROLL_SKIP_TIERS_SECONDS } from "@/app/lib/videoAds";
import { AD_CREATIVES_TABLE } from "@/app/lib/adCreatives";

export async function GET() {
  const settings = await getPlatformSettings();

  try {
    // 1. Try dedicated Midroll ads table
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

    let activeItems = items.filter((item) => item.active !== false);

    // 2. Fallback: if no dedicated midroll items, query House Ad Creatives table
    let isHouseFallback = false;
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

      activeItems = houseItems.filter((item) => item.active !== false);
      isHouseFallback = true;
    }

    if (activeItems.length === 0) {
      return NextResponse.json({ enabled: false });
    }

    const pick = activeItems[Math.floor(Math.random() * activeItems.length)];
    const targetTable = isHouseFallback ? AD_CREATIVES_TABLE : MIDROLL_ADS_TABLE;

    if (pick.adId) {
      docClient
        .send(
          new UpdateCommand({
            TableName: targetTable,
            Key: { adId: pick.adId },
            UpdateExpression: "ADD impressions :one",
            ExpressionAttributeValues: { ":one": 1 },
          })
        )
        .catch((err) => console.error("midroll-ads: impression counter failed:", err));
    }

    return NextResponse.json({
      enabled: true,
      intervalSeconds: settings.midrollIntervalSeconds || 180,
      skipTiersSeconds: MIDROLL_SKIP_TIERS_SECONDS,
      ad: {
        adId: pick.adId,
        imageUrl: pick.imageUrl,
        linkUrl: pick.linkUrl,
        title: pick.title,
      },
    });
  } catch (err) {
    console.error("Midroll ad lookup failed:", err);
    return NextResponse.json({ enabled: false });
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
      // Best effort fallback to AD_CREATIVES_TABLE
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
