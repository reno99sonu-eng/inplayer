import { BatchGetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dynamodb";
import { getMuxThumbnailUrl } from "./muxThumbnail";
import { getReadyVideos } from "./videoStore";
import { ensureUsername } from "./ensureUsername";

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
        uploaderId: (video.uploaderId as string) || null,
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

export interface TrendingCreator {
  userId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  isVerified: boolean;
  windowViews: number;
}

// The Trending algorithm deliberately stays video-based: each video's views
// are still calculated from today's daily-view bucket. This presentation
// groups those ranked videos by uploader, so one creator with several popular
// videos is ranked by their combined real momentum rather than by a made-up
// profile metric. Profiles are hydrated in one BatchGet, avoiding N+1 reads.
export async function getTrendingCreatorsToday(
  limit = 20
): Promise<TrendingCreator[]> {
  const rankedVideos = await getTrendingToday(60);
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

  // A trending creator needs a real channel destination too. Without this,
  // any profile that predates usernames (or never got a username reserved)
  // silently vanished from the whole Trending Creators list below — the
  // same failure mode getFeaturedThisWeek already guards against. Self-heal
  // via the shared ensureUsername() so every creator with real views gets a
  // working /u/[username] link, not just the ones that happened to have one.
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
// before it), not a fixed Mon-Sun bucket. That means the lineup can shift
// a little every day rather than only flipping once a week, and it needs
// no timezone-aware "start of week" math. DynamoDB can't Query across
// multiple partition-key values in one call (date is the partition key),
// so this is 7 parallel single-day Queries merged in memory — the same
// fan-out idiom app/api/my-videos/analytics already uses for per-video
// comment counts.
export async function getFeaturedThisWeek(limit = 6): Promise<RankedVideo[]> {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    return dateKey(d);
  });
  // A weekly feature is creator-led and must have a channel destination.
  // Video rows without an uploader cannot provide that experience.
  const videos = (await rankByWindow(days, limit)).filter(
    (video) => Boolean(video.uploaderId)
  );
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
  // A channel is addressed by a reservation in InPlayer-Usernames, not just
  // the username field on a profile. Reconcile every featured creator here:
  // this repairs legacy rows with a display handle but no lookup entry before
  // the Details button is rendered.
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
