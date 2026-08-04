import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { MIDROLL_ADS_TABLE, MIDROLL_SKIP_TIERS_SECONDS, getAllMidrollAds } from "@/app/lib/videoAds";

// Public, unauthenticated — app/components/VideoPlayer.tsx calls this
// once per mount to learn whether mid-roll breaks are on at all and, if
// so, which creative to show when a break triggers. Same
// "resolve-once-then-reuse" shape as AdBanner/api/ads, not fetched again
// per break — a single video playback shows the same picked creative at
// every break it triggers, which also keeps the impression counter
// meaning "this creative was queued up for a viewer," same convention as
// the homepage/watch banner's impression count.
export async function GET() {
  const settings = await getPlatformSettings();

  if (!settings.midrollEnabled) {
    return NextResponse.json({ enabled: false });
  }

  // Reads the shared 30-second cached scan (see getAllMidrollAds in
  // app/lib/videoAds.ts) instead of running a fresh full table Scan on
  // every single video mount — this endpoint fires once per playback, so
  // on a busy video that was one uncached Scan per viewer per view.
  try {
    const allAds = await getAllMidrollAds();
    const items = allAds.filter((item) => item.active === true);

    if (items.length === 0) {
      return NextResponse.json({ enabled: false });
    }

    const pick = items[Math.floor(Math.random() * items.length)];

    docClient
      .send(
        new UpdateCommand({
          TableName: MIDROLL_ADS_TABLE,
          Key: { adId: pick.adId },
          UpdateExpression: "ADD impressions :one",
          ExpressionAttributeValues: { ":one": 1 },
        })
      )
      .catch((err) => console.error("midroll-ads: impression counter failed:", err));

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
    });
  } catch (err) {
    console.error("Midroll ad lookup failed (table may not exist yet):", err);
    return NextResponse.json({ enabled: false });
  }
}

// Real click/skip tracking, fired by VideoPlayer's mid-roll overlay.
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
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Midroll ad tracking failed:", err);
    return NextResponse.json({ success: false });
  }
}
