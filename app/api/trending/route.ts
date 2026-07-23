import { NextResponse } from "next/server";
import { getTrendingToday } from "@/app/lib/trendingStore";

// Real "most-viewed today" videos, ranked from InPlayer-Video-Daily-Views
// (see app/lib/trendingStore) — no dummy/example entries. An empty
// `videos` array is a real, expected state (no views logged yet today, or
// the table isn't provisioned) and the frontend renders an honest "check
// back later" empty state for it rather than falling back to anything fake.
export async function GET() {
  const videos = await getTrendingToday(20);
  return NextResponse.json({ videos });
}
