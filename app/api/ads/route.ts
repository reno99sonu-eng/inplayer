import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { AD_CREATIVES_TABLE, AdPlacement, getAllAdCreatives } from "@/app/lib/adCreatives";

// Public, unauthenticated — every visitor's browser calls this to decide
// what (if anything) to render in a given ad slot. Reads the real,
// per-slot source Admin Panel -> Advertising sets (house creative /
// AdSense / off — see app/lib/platformSettings.ts) and, for "house",
// returns every real active creative for that placement (shuffled, capped)
// so AdThumbnailCard.tsx can rotate/crossfade through all of them in one
// page view — same idea as FeaturedHeroAd.tsx's weekly_featured carousel —
// instead of only ever showing a single randomly-picked one per page load.
const VALID_PLACEMENTS: AdPlacement[] = ["homepage", "watch", "weekly_featured"];

// A single sponsor tops out at 3 images per section (see
// app/lib/sponsorships.ts), but several sponsors can run the same
// placement at once — cap how many any one visitor's card cycles through
// so a busy week (the "100 sponsors" case) never turns one small ad slot
// into a multi-minute slideshow. Different visitors still get a different
// random sample since the pool is shuffled on every request.
const MAX_CREATIVES_PER_SLOT = 12;

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

    // Fisher-Yates shuffle, then cap — every visitor gets a differently
    // ordered, differently sampled rotation instead of everyone seeing the
    // same items in the same DynamoDB scan order.
    const shuffled = items.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const picked = shuffled.slice(0, MAX_CREATIVES_PER_SLOT);

    const creatives = picked.map((item) => ({
      adId: item.adId,
      imageUrl: item.imageUrl,
      imageUrlDesktop: item.imageUrlDesktop || undefined,
      linkUrl: item.linkUrl,
      title: item.title,
    }));

    // Impressions are now counted client-side, one per creative actually
    // shown (see AdThumbnailCard.tsx's POST .../api/ads {event:
    // "impression"} on every rotation step) instead of blindly incrementing
    // here on every fetch — this endpoint now hands back a whole batch, not
    // just the one item that used to get counted.
    return NextResponse.json({
      source: "house",
      // Kept for back-compat with any other consumer of this shape — the
      // first item of the same shuffled batch below.
      creative: creatives[0],
      creatives,
    });
  } catch (err) {
    console.error("Ad creatives lookup failed (table may not exist yet):", err);
    return NextResponse.json({ source: "off" });
  }
}

// Real click-and-impression tracking — fired by the placement's ad
// component (see AdThumbnailCard.tsx and FeaturedHeroAd.tsx). Fire-and-
// forget on the client side, so a slow/failed write never delays a click's
// navigation or a rotation's next frame.
//
// `event` defaults to "click" so every pre-existing caller (FeaturedHeroAd
// and AdThumbnailCard's own click handler, both of which only ever sent
// {adId}) keeps incrementing clicks exactly as before. AdThumbnailCard now
// also sends {adId, event: "impression"} once per creative it actually
// rotates into view, since GET .../api/ads no longer counts impressions
// itself now that it hands back a whole batch instead of one pre-picked
// item.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const adId = body?.adId;
  const event = body?.event === "impression" ? "impression" : "click";
  if (!adId || typeof adId !== "string") {
    return NextResponse.json({ error: "adId is required." }, { status: 400 });
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: AD_CREATIVES_TABLE,
        Key: { adId },
        UpdateExpression: event === "impression" ? "ADD impressions :one" : "ADD clicks :one",
        ExpressionAttributeValues: { ":one": 1 },
      })
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`Ad ${event} tracking failed:`, err);
    return NextResponse.json({ success: false });
  }
}
