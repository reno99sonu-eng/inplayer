import { NextResponse } from "next/server";
import { getFeaturedThisWeek } from "@/app/lib/trendingStore";

// See app/api/platform-settings/route.ts's comment on force-dynamic — same
// no-request-signal shape, same problem: this must be recomputed fresh on
// every request, not served from a frozen snapshot.
export const dynamic = "force-dynamic";

// Real "most-viewed over the trailing 7 days" videos, ranked from
// InPlayer-Video-Daily-Views (see app/lib/trendingStore) — no dummy/
// example slides. Recomputed on every request from a rolling window, so
// the lineup naturally shifts day to day rather than only flipping once a
// week. An empty `videos` array is a real, expected state and the
// frontend renders an honest empty state for it.
export async function GET() {
  const videos = await getFeaturedThisWeek(6);
  return NextResponse.json({ videos });
}
