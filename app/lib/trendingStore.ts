import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dynamodb";
import { getMuxThumbnailUrl } from "./muxThumbnail";
import { getReadyVideos } from "./videoStore";

const DAILY_VIEWS_TABLE = "InPlayer-Video-Daily-Views";

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

// One calendar day's { videoId -> views that day } map. The table is
// partitioned by date (see app/watch/[videoId]/page.tsx, which writes to
// it), so one day is a single indexed Query. Returns an empty map — not a
// thrown error — if the table doesn't exist yet or the day has no rows:
// same "real data or an honest empty state, never fake" convention as the
// rest of this app. Callers decide what an empty result means for their UI.
async function getDayViews(date: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: DAILY_VIEWS_TABLE,
        KeyConditionExpression: "#d = :d",
        ExpressionAttributeNames: { "#d": "date" },
        ExpressionAttributeValues: { ":d": date },
      })
    );
    for (const item of result.Items || []) {
      map.set(item.videoId as string, (item.views as number) || 0);
    }
  } catch (err) {
    console.error(`Daily views unavailable for ${date}:`, err);
  }
  return map;
}

export interface RankedVideo {
  videoId: string;
  title: string;
  uploaderName: string;
  uploaderAvatarUrl: string | null;
  thumbnailUrl: string | null;
  windowViews: number; // views within the requested window (today, or the trailing 7 days) — NOT the all-time counter on the video item
}

function resolveThumbnailUrl(video: Record<string, unknown>): string | null {
  const storedThumbnail = video.thumbnailUrl;

  if (typeof storedThumbnail === "string" && storedThumbnail.trim()) {
    return storedThumbnail;
  }

  const playbackId = video.muxPlaybackId;
  return typeof playbackId === "string"
    ? getMuxThumbnailUrl(playbackId)
    : null;
}

// Sums view counts across the given UTC day-keys per video, then hydrates
// against the shared ready-videos list (see app/lib/videoStore) for
// title/thumbnail/uploader. Videos-only — Shorts already have their own
// dedicated feed and never belong in a "trending videos" list, same
// convention app/watch/[videoId]/page.tsx already applies to its Up Next
// list. Deleted/unpublished videos that still have leftover daily-view
// rows are silently dropped rather than shown broken.
async function rankByWindow(
  dayKeys: string[],
  limit: number
): Promise<RankedVideo[]> {
  const dayMaps = await Promise.all(dayKeys.map(getDayViews));

  const totals = new Map<string, number>();
  for (const dayMap of dayMaps) {
    for (const [videoId, views] of dayMap) {
      totals.set(videoId, (totals.get(videoId) || 0) + views);
    }
  }

  if (totals.size === 0) return [];

  const allVideos = await getReadyVideos();
  const byId = new Map(allVideos.map((v) => [v.videoId as string, v]));

  return Array.from(totals.entries())
    .map(([videoId, windowViews]): RankedVideo | null => {
      const video = byId.get(videoId);
      if (
        !video ||
        video.contentType === "short" ||
        (video.visibility && video.visibility !== "public")
      ) {
        return null;
      }
      return {
        videoId,
        title: video.title as string,
        uploaderName: (video.uploaderName as string) || "Unknown",
        uploaderAvatarUrl: (video.uploaderAvatarUrl as string) || null,
        // Current uploads persist this field at video.asset.ready. Derive it
        // from the playback ID too, so ready videos created before that field
        // existed do not fall back to the avatar.
        thumbnailUrl: resolveThumbnailUrl(video),
        windowViews,
      };
    })
    .filter((v): v is RankedVideo => v !== null)
    .sort((a, b) => b.windowViews - a.windowViews)
    .slice(0, limit);
}

// "Trending Now" — today's UTC calendar day so far. A single Query.
export function getTrendingToday(limit = 20): Promise<RankedVideo[]> {
  return rankByWindow([dateKey(new Date())], limit);
}

// "Featured Weekly" — a rolling trailing 7-day window (today + the 6
// before it), not a fixed Mon-Sun bucket. That means the lineup can shift
// a little every day rather than only flipping once a week, and it needs
// no timezone-aware "start of week" math. DynamoDB can't Query across
// multiple partition-key values in one call (date is the partition key),
// so this is 7 parallel single-day Queries merged in memory — the same
// fan-out idiom app/api/my-videos/analytics already uses for per-video
// comment counts.
export function getFeaturedThisWeek(limit = 6): Promise<RankedVideo[]> {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    return dateKey(d);
  });
  return rankByWindow(days, limit);
}
