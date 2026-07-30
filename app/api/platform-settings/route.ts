import { NextResponse } from "next/server";
import { getPlatformSettings, toPublicSettings } from "@/app/lib/platformSettings";

// Public, unauthenticated — every visitor's browser needs these to know
// whether to show the maintenance splash, the announcement banner, a real
// AdSense unit, or a house ad, before they've necessarily signed in at
// all. Only the safe subset (see toPublicSettings) is ever returned here.
export async function GET() {
  const settings = await getPlatformSettings();
  return NextResponse.json(toPublicSettings(settings));
}
