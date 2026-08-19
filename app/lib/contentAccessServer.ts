import { cookies } from "next/headers";
import { getReadyVideos } from "./videoStore";
import {
  AUDIENCE_COOKIE,
  DEFAULT_AUDIENCE_MODE,
  filterByAudience,
  isVideoVisible,
  normalizeAudienceMode,
  type AudienceMode,
} from "./contentAccess";

// Server-side half of the content-access system (the pure rules live in
// contentAccess.ts, which this re-exports nothing from on purpose — import
// the types you need from there directly).
//
// Why the cookie rather than localStorage: every listing surface in this
// app is server-rendered, so the filtering has to happen on the server for
// 18+ content to never reach the browser at all. A Server Component can
// read a cookie; it cannot read localStorage. The cookie is set HttpOnly by
// app/api/content-access/route.ts only after the 6-digit passkey has been
// verified against the account, so it can't be forged client-side either.

export async function getAudienceMode(): Promise<AudienceMode> {
  try {
    const store = await cookies();
    return normalizeAudienceMode(store.get(AUDIENCE_COOKIE)?.value);
  } catch {
    // cookies() throws in any genuinely static rendering context. Falling
    // back to the default is the safe direction: hide 18+, never reveal it.
    return DEFAULT_AUDIENCE_MODE;
  }
}

// The audience-filtered replacement for getReadyVideos(), and the one every
// listing surface should call.
//
// Note the filtering deliberately happens OUTSIDE getReadyVideos' cache:
// that cache is shared across all viewers for 30 seconds (see
// app/lib/videoStore.ts), so filtering inside it would leak one viewer's
// mode into everyone else's results. This reads the shared cached list and
// then narrows it per request, which costs one array pass and nothing else.
export async function getVisibleVideos(): Promise<Record<string, unknown>[]> {
  const [videos, mode] = await Promise.all([getReadyVideos(), getAudienceMode()]);
  return filterByAudience(videos, mode);
}

// For the personal lists — Watchlist, Watch History, Playlists — whose rows
// are snapshots (title/thumbnail copied when the item was saved) and carry
// no audience field of their own. Rather than a GetItem per row, this
// resolves each id against the same 30-second shared cache every feed
// already uses, so a 200-item history costs one cached read and a map
// lookup per row.
//
// An id missing from that list is treated as a bare video with no audience
// recorded — deliberately, because that resolves to "everyone", which is
// visible in family mode but correctly hidden in Kids-only mode. Those ids
// are ones that aren't publicly listable anyway (private, unlisted, still
// processing, or moderation-hidden), and the watch page's own gate is what
// actually stops playback in every case.
export async function filterListByAudience<T>(
  items: T[],
  getVideoId: (item: T) => string | null | undefined
): Promise<T[]> {
  const mode = await getAudienceMode();
  if (mode === "all") return items;

  const all = await getReadyVideos();
  const byId = new Map(all.map((video) => [video.videoId as string, video]));

  return items.filter((item) => {
    const videoId = getVideoId(item);
    // A row with no id at all is treated exactly like an unresolvable one —
    // no special case. That resolves to "everyone": kept in family mode,
    // dropped in Kids-only mode, which is the safe direction for a row we
    // can't actually classify.
    return isVideoVisible(videoId ? byId.get(videoId) ?? {} : {}, mode);
  });
}
