import { BatchGetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dynamodb";
import { getMuxThumbnailUrl } from "./muxThumbnail";
import { getVisibleVideos } from "./contentAccessServer";
import { ensureUsername } from "./ensureUsername";
import { isMusicType } from "./contentTypes";

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
  uploaderId: string | null;
  title: string;
  uploaderName: string;
  uploaderAvatarUrl: string | null;
  uploaderUsername?: string | null;
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

  const allVideos = await getVisibleVideos();
  const byId = new Map(allVideos.map((v) => [v.videoId as string, v]));

  return Array.from(totals.entries())
    .map(([videoId, windowViews]): RankedVideo | null => {
      const video = byId.get(videoId);
      if (
        !video ||
        video.contentType === "short" ||
        isMusicType(video.contentType) ||
        (video.visibility && video.visibility !== "public")
      ) {
        return null;
      }
      return {
        videoId,
        uploaderId: (video.uploaderId as string) || null,
        title: video.title as string,
        uploaderName: (video.uploaderName as string) || "Unknown",
        uploaderAvatarUrl: (video.uploaderAvatarUrl as string) || null,
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

export interface TrendingCreator {
  userId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  isVerified: boolean;
  windowViews: number;
}

// Powers the public homepage "Trending Creators" strip ONLY (see
// app/api/trending/route.ts) — tries today's UTC calendar day first, same
// as getTrendingToday, but progressively widens to a 3-day then 7-day
// trailing window if that comes back empty, instead of returning nothing.
// A single quiet UTC day (early in the day, a brief traffic dip, or an
// extended stretch with maintenance mode on — see MaintenanceGate.tsx,
// which blocks every non-admin visitor from watching anything, so no daily
// views get recorded at all) used to make the whole strip vanish outright
// with zero fallback, which read as "this feature is broken" even though
// no code was wrong — there just wasn't a single real view yet today.
// Deliberately NOT used by Admin Panel -> Analytics' own "today" stat
// (getTrendingToday, called directly there) — that number needs to mean
// literally today, not a rolling window.
async function rankedVideosForTrendingCreators(limit: number): Promise<RankedVideo[]> {
  const today = await getTrendingToday(limit);
  if (today.length > 0) return today;

  const last3Days = Array.from({ length: 3 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    return dateKey(d);
  });
  const recentFew = await rankByWindow(last3Days, limit);
  if (recentFew.length > 0) return recentFew;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    return dateKey(d);
  });
  return rankByWindow(last7Days, limit);
}

// The Trending algorithm deliberately stays video-based: each video's views
// are still calculated from real daily-view buckets (today, widening only
// if needed — see rankedVideosForTrendingCreators above). This presentation
// groups those ranked videos by uploader, so one creator with several popular
// videos is ranked by their combined real momentum rather than by a made-up
// profile metric. Profiles are hydrated in one BatchGet, avoiding N+1 reads.
export async function getTrendingCreators(
  limit = 20
): Promise<TrendingCreator[]> {
  const rankedVideos = await rankedVideosForTrendingCreators(60);
  const creators = new Map<
    string,
    { name: string; avatarUrl: string | null; windowViews: number }
  >();

  for (const video of rankedVideos) {
    if (!video.uploaderId) continue;
    const existing = creators.get(video.uploaderId);
    creators.set(video.uploaderId, {
      name: existing?.name || video.uploaderName || "Unknown Creator",
      avatarUrl: existing?.avatarUrl || video.uploaderAvatarUrl,
      windowViews: (existing?.windowViews || 0) + video.windowViews,
    });
  }

  // Fallback / supplement: If active daily views have fewer than 10 creators,
  // supplement from visible public longform videos (strictly excluding music/shorts)
  // so the homefeed strip is always populated with real active creators.
  if (creators.size < limit) {
    try {
      const allVideos = await getVisibleVideos();
      for (const v of allVideos) {
        if (
          v.contentType === "short" ||
          isMusicType(v.contentType) ||
          (v.visibility && v.visibility !== "public") ||
          !v.uploaderId
        ) {
          continue;
        }
        const uId = v.uploaderId as string;
        const existing = creators.get(uId);
        const views = (v.views as number) || 0;
        creators.set(uId, {
          name: existing?.name || (v.uploaderName as string) || "Unknown Creator",
          avatarUrl: existing?.avatarUrl || (v.uploaderAvatarUrl as string) || null,
          windowViews: (existing?.windowViews || 0) + views,
        });
      }
    } catch (err) {
      console.error("Failed to supplement trending creators:", err);
    }
  }

  const creatorIds = Array.from(creators.keys());
  if (creatorIds.length === 0) return [];

  const profilesResult = await docClient.send(
    new BatchGetCommand({
      RequestItems: {
        "InPlayer-Users": {
          Keys: creatorIds.map((userId) => ({ userId })),
          ProjectionExpression:
            "userId, username, #name, avatarUrl, verified, isVerified, creatorVerified",
          ExpressionAttributeNames: { "#name": "name" },
        },
      },
    })
  );
  const profiles = new Map(
    (profilesResult.Responses?.["InPlayer-Users"] || []).map((profile) => [
      profile.userId as string,
      profile,
    ])
  );

  const missingUsernameIds = creatorIds.filter(
    (userId) => !(profiles.get(userId)?.username as string | undefined)
  );
  if (missingUsernameIds.length) {
    const ensured = await Promise.all(
      missingUsernameIds.map(
        async (userId) => [userId, await ensureUsername(userId)] as const
      )
    );
    for (const [userId, username] of ensured) {
      profiles.set(userId, { ...(profiles.get(userId) || {}), username });
    }
  }

  return creatorIds
    .map((userId): TrendingCreator | null => {
      const aggregate = creators.get(userId);
      const profile = profiles.get(userId);
      const username = profile?.username as string | undefined;
      if (!aggregate || !username) return null;

      return {
        userId,
        username,
        name: (profile?.name as string) || aggregate.name,
        avatarUrl: (profile?.avatarUrl as string) || aggregate.avatarUrl,
        isVerified: Boolean(
          profile?.verified || profile?.isVerified || profile?.creatorVerified
        ),
        windowViews: aggregate.windowViews,
      };
    })
    .filter((creator): creator is TrendingCreator => creator !== null)
    .sort((a, b) => b.windowViews - a.windowViews)
    .slice(0, limit);
}

// "Featured Weekly" — a rolling trailing 7-day window (today + the 6
// before it), not a fixed Mon-Sun bucket. Strictly non-music and non-short videos.
export async function getFeaturedThisWeek(limit = 6): Promise<RankedVideo[]> {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    return dateKey(d);
  });
  let videos = (await rankByWindow(days, limit)).filter(
    (video) => Boolean(video.uploaderId)
  );

  // Fallback: If weekly views are empty, supplement with top public non-music videos
  if (videos.length < limit) {
    try {
      const allVideos = await getVisibleVideos();
      const nonMusic = allVideos
        .filter(
          (v) =>
            v.contentType !== "short" &&
            !isMusicType(v.contentType) &&
            (!v.visibility || v.visibility === "public") &&
            Boolean(v.uploaderId)
        )
        .sort((a, b) => ((b.views as number) || 0) - ((a.views as number) || 0));

      const existingIds = new Set(videos.map((v) => v.videoId));
      for (const v of nonMusic) {
        const vid = v.videoId as string;
        if (!existingIds.has(vid)) {
          videos.push({
            videoId: vid,
            uploaderId: (v.uploaderId as string) || null,
            title: v.title as string,
            uploaderName: (v.uploaderName as string) || "Unknown",
            uploaderAvatarUrl: (v.uploaderAvatarUrl as string) || null,
            thumbnailUrl: resolveThumbnailUrl(v),
            windowViews: (v.views as number) || 0,
          });
          existingIds.add(vid);
          if (videos.length >= limit) break;
        }
      }
    } catch (err) {
      console.error("Failed to supplement featured weekly videos:", err);
    }
  }

  const userIds = Array.from(
    new Set(videos.map((video) => video.uploaderId).filter((id): id is string => Boolean(id)))
  );
  if (!userIds.length) return videos;

  const profiles = await docClient.send(
    new BatchGetCommand({
      RequestItems: {
        "InPlayer-Users": {
          Keys: userIds.map((userId) => ({ userId })),
          ProjectionExpression: "userId, username",
        },
      },
    })
  );
  const usernames = new Map(
    (profiles.Responses?.["InPlayer-Users"] || []).map((profile) => [
      profile.userId as string,
      profile.username as string | undefined,
    ])
  );

  const ensuredUsernames = await Promise.all(
    userIds.map(async (userId) => [userId, await ensureUsername(userId)] as const)
  );
  for (const [userId, username] of ensuredUsernames) {
    usernames.set(userId, username);
  }

  return videos.map((video) => ({
    ...video,
    uploaderUsername: video.uploaderId ? usernames.get(video.uploaderId) || null : null,
  }));
}
