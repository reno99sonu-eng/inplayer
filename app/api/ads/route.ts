import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { AD_CREATIVES_TABLE, AdPlacement, getAllAdCreatives } from "@/app/lib/adCreatives";

// Public, unauthenticated — every visitor's browser calls this to decide
// what (if anything) to render in a given ad slot. Reads the real,
// per-slot source Admin Panel -> Advertising sets (house creative /
// AdSense / off — see app/lib/platformSettings.ts) and, for "house",
// picks one real active creative for that placement at random so
// multiple uploads for the same slot rotate naturally instead of only
// the newest one ever showing.
const VALID_PLACEMENTS: AdPlacement[] = ["homepage", "watch", "weekly_featured"];

export async function GET(request: NextRequest) {
  const placement = request.nextUrl.searchParams.get("placement") as AdPlacement | null;
  if (!placement || !VALID_PLACEMENTS.includes(placement)) {
    return NextResponse.json({ error: "Invalid placement." }, { status: 400 });
  }

  const settings = await getPlatformSettings();
  // "weekly_featured" isn't a house/adsense/off three-way slot like the
  // others — Admin Panel -> Advertising -> Weekly Featured Banner is a
  // single ON/OFF switch (weeklyFeaturedEnabled) that swaps the homepage
  // hero between real Weekly Featured videos (OFF, default — see
  // app/page.tsx / FeaturedHero.tsx) and an admin-uploaded poster (ON).
  // There's no AdSense option for this slot, so ON always means "house".
  const source =
    placement === "homepage"
      ? settings.homepageBannerSource
      : placement === "watch"
      ? settings.watchPageBannerSource
      : settings.weeklyFeaturedEnabled
      ? "house"
      : "off";

  if (source === "off") {
    return NextResponse.json({ source: "off" });
  }

  if (source === "adsense") {
    if (!settings.adsenseEnabled || !settings.adsensePublisherId) {
      return NextResponse.json({ source: "off" });
    }
    return NextResponse.json({ source: "adsense", adsensePublisherId: settings.adsensePublisherId });
  }

  // source === "house" — reads the shared 30-second cached scan (see
  // getAllAdCreatives in app/lib/adCreatives.ts) instead of running a
  // fresh full table Scan for every single ad slot on every single page
  // view, which is what made every page load hit DynamoDB multiple times
  // before this. The placement+active filter that used to be a
  // FilterExpression on the Scan itself now just runs in memory.
  try {
    const allCreatives = await getAllAdCreatives();
    const now = Date.now();
    const items = allCreatives.filter(
      (item) =>
        item.placement === placement &&
        item.active === true &&
        // A sponsor's paid creative carries its own expiresAt (see
        // app/lib/sponsorships.ts) — once that's passed it drops out of
        // rotation immediately, independent of the daily expiry cron.
        (!item.expiresAt || new Date(item.expiresAt as string).getTime() > now)
    );

    if (items.length === 0) {
      return NextResponse.json({ source: "off" });
    }

    const pick = items[Math.floor(Math.random() * items.length)];

    // Best-effort impression counter — never blocks or fails the actual
    // response if this write hiccups.
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

    return NextResponse.json({
      source: "house",
      creative: {
        adId: pick.adId,
        imageUrl: pick.imageUrl,
        imageUrlDesktop: pick.imageUrlDesktop || undefined,
        linkUrl: pick.linkUrl,
        title: pick.title,
      },
    });
  } catch (err) {
    console.error("Ad creatives lookup failed (table may not exist yet):", err);
    return NextResponse.json({ source: "off" });
  }
}

// Real click-tracking — fired by the placement's ad component (see
// AdThumbnailCard.tsx and FeaturedHeroAd.tsx) right before it navigates
// the visitor to the creative's real linkUrl. Fire-and-forget on the
// client side, so a slow/failed write never delays the click.
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
