import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { selfHealMidrollAdsBatch } from "@/app/lib/videoAdsHealer";
import { MIDROLL_ADS_TABLE, MIDROLL_SKIP_TIERS_SECONDS, getAllMidrollAds } from "@/app/lib/videoAds";

// Public, unauthenticated — app/components/VideoPlayer.tsx calls this
// once per mount to learn whether mid-roll breaks are on at all and, if
// so, which creative to show when a break triggers.
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getPlatformSettings();

  if (!settings.midrollEnabled) {
    return NextResponse.json({ enabled: false });
  }

  try {
    const allAds = await getAllMidrollAds();
    const now = Date.now();

    let items = allAds.filter(
      (item) =>
        item.active === true &&
        (item.status === undefined || item.status === "ready") &&
        (!item.expiresAt || new Date(item.expiresAt as string).getTime() > now)
    );

    // If no ready ads yet, but there are processing video ads, attempt
    // an immediate self-heal check with Mux so newly-uploaded ads become
    // live without waiting for a webhook.
    if (items.length === 0 && allAds.some((a) => a.status === "processing")) {
      const healed = await selfHealMidrollAdsBatch(allAds);
      items = healed.filter(
        (item) =>
          item.active === true &&
          (item.status === undefined || item.status === "ready") &&
          (!item.expiresAt || new Date(item.expiresAt as string).getTime() > now)
      );
    }

    if (items.length === 0) {
      return NextResponse.json({ enabled: false });
    }

    const pick = items[Math.floor(Math.random() * items.length)];

    // Notice: impressions are counted when an ad actually starts playback
    // via POST /api/midroll-ads { adId, kind: 'impression' } instead of
    // blindly incrementing on fetch.

    return NextResponse.json({
      enabled: true,
      intervalSeconds: settings.midrollIntervalSeconds,
      skipTiersSeconds: MIDROLL_SKIP_TIERS_SECONDS,
      ad: {
        adId: pick.adId,
        imageUrl: pick.imageUrl,
        linkUrl: pick.linkUrl,
        title: pick.title,
      },
      ads: items.map((i) => ({
        adId: i.adId,
        imageUrl: i.imageUrl,
        linkUrl: i.linkUrl,
        title: i.title,
      })),
    });
  } catch (err) {
    console.error("Midroll ad lookup failed (table may not exist yet):", err);
    return NextResponse.json({ enabled: false });
  }
}

// Real impression/click/skip tracking, fired by player ad overlays when an ad
// actually plays, is clicked, or is skipped.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const adId = body?.adId;
  const kind = body?.kind;
  if (
    !adId ||
    typeof adId !== "string" ||
    (kind !== "click" && kind !== "skip" && kind !== "impression")
  ) {
    return NextResponse.json(
      { error: "adId and a valid kind (impression, click, skip) are required." },
      { status: 400 }
    );
  }

  try {
    const attribute =
      kind === "impression" ? "impressions" : kind === "click" ? "clicks" : "skips";
    await docClient.send(
      new UpdateCommand({
        TableName: MIDROLL_ADS_TABLE,
        Key: { adId },
        UpdateExpression: `ADD ${attribute} :one`,
        ExpressionAttributeValues: { ":one": 1 },
      })
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Midroll ad tracking failed:", err);
    return NextResponse.json({ success: false });
  }
}
