import { NextResponse } from "next/server";
import { getPlatformSettings, toPublicSettings } from "@/app/lib/platformSettings";

// This route has no request-based signal (no cookies/headers/searchParams)
// and nothing else marking it dynamic, so without this it's a candidate for
// being cached and served from a single frozen snapshot instead of running
// fresh on every request — exactly wrong for a route whose entire job is
// telling every visitor's browser the CURRENT maintenance/announcement
// state. force-dynamic (and the no-store header it implies) guarantees
// every request actually re-reads the settings row, so an admin toggle in
// Platform Settings takes effect immediately for real visitors instead of
// only appearing to, until whenever the next deploy happens to refresh it.
export const dynamic = "force-dynamic";

// Public, unauthenticated — every visitor's browser needs these to know
// whether to show the maintenance splash, the announcement banner, a real
// AdSense unit, or a house ad, before they've necessarily signed in at
// all. Only the safe subset (see toPublicSettings) is ever returned here.
export async function GET() {
  const settings = await getPlatformSettings();
  return NextResponse.json(toPublicSettings(settings));
}
