import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

// Studio-style channel analytics, split by content type (regular videos,
// Shorts, and audio-only Music). Every number here is real, sourced from the same tables the rest
// of the app already writes to — nothing on this page is fabricated:
//   - views / shareCount live directly on each InPlayer-Videos item
//   - likes come from InPlayer-Likes (reaction === "like")
//   - comments come from InPlayer-Comments (Query is cheap; it's keyed by videoId)
//   - subscriberCount comes from InPlayer-Subscriptions, same query SubscribeButton uses
// "Reach" is reported as total views — this app doesn't yet distinguish
// unique viewers from repeat views, so rather than invent a separate
// number, reach and views are honestly the same source today.
interface EmptyStats {
  count: number;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

function emptyStats(): EmptyStats {
  return { count: 0, reach: 0, views: 0, likes: 0, comments: 0, shares: 0 };
}

interface TrendPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

const DAILY_STATS_TABLE = "InPlayer-Channel-Daily-Stats";
const TREND_DAYS = 30;

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  // 1) This creator's videos, split by content type. Paginated — a
  // one-shot Scan silently stops at ~1MB, which would quietly undercount
  // views/shares/video-count once the table grows past that (see the same
  // fix already applied in app/lib/videoStore.ts and
  // app/api/admin/analytics/route.ts).
  // Scanned items feed arithmetic below (views/shares totals), which
  // Record<string, unknown> would break (same tradeoff already made
  // throughout this file).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allVideos: Record<string, any>[] = [];
  {
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const videosResult = await docClient.send(
        new ScanCommand({
          TableName: "InPlayer-Videos",
          FilterExpression: "uploaderId = :uploaderId",
          ExpressionAttributeValues: { ":uploaderId": user.userId },
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      allVideos.push(...(videosResult.Items || []));
      exclusiveStartKey = videosResult.LastEvaluatedKey as
        | Record<string, unknown>
        | undefined;
    } while (exclusiveStartKey);
  }
  // Three disjoint buckets. Music used to fall into `videoItems` (the
  // filter was simply `!== "short"`), which is right for the monetization
  // threshold in app/lib/monetization.ts but wrong here — the creator
  // asked to see how their music is doing, and a number that has their
  // videos mixed into it cannot answer that. A row with no contentType at
  // all is a pre-music upload and is a video, as everywhere else.
  const shortItems = allVideos.filter((v) => v.contentType === "short");
  const musicItems = allVideos.filter((v) => v.contentType === "music");
  const videoItems = allVideos.filter(
    (v) => v.contentType !== "short" && v.contentType !== "music"
  );
  const videoIds = new Set(allVideos.map((v) => v.videoId));

  // Built once and reused by both the likes aggregation and the comment
  // tally below. (The likes loop previously did a linear `.some()` over
  // every short for every single like — fine at ten videos, quadratic at a
  // thousand.)
  const shortIdSet = new Set(shortItems.map((v) => v.videoId));
  const musicIdSet = new Set(musicItems.map((v) => v.videoId));

  const stats: { videos: EmptyStats; shorts: EmptyStats; music: EmptyStats } = {
    videos: emptyStats(),
    shorts: emptyStats(),
    music: emptyStats(),
  };
  stats.videos.count = videoItems.length;
  stats.shorts.count = shortItems.length;
  stats.music.count = musicItems.length;
  for (const v of videoItems) {
    stats.videos.views += v.views || 0;
    stats.videos.shares += v.shareCount || 0;
  }
  for (const s of shortItems) {
    stats.shorts.views += s.views || 0;
    stats.shorts.shares += s.shareCount || 0;
  }
  for (const m of musicItems) {
    stats.music.views += m.views || 0;
    stats.music.shares += m.shareCount || 0;
  }
  stats.videos.reach = stats.videos.views;
  stats.shorts.reach = stats.shorts.views;
  stats.music.reach = stats.music.views;

  // 2) Likes — one scan of the reactions that are actually "like"s, grouped
  // back onto this creator's own videos in memory. Fine at InPlayer's
  // current scale (same tradeoff /api/likes already makes per-video); a
  // reverse videoId index on InPlayer-Likes would make this cheaper later.
  if (videoIds.size > 0) {
    try {
      let exclusiveStartKey: Record<string, unknown> | undefined;
      do {
        const likesResult = await docClient.send(
          new ScanCommand({
            TableName: "InPlayer-Likes",
            FilterExpression: "reaction = :like",
            ExpressionAttributeValues: { ":like": "like" },
            ExclusiveStartKey: exclusiveStartKey,
          })
        );
        for (const item of likesResult.Items || []) {
          if (!videoIds.has(item.videoId)) continue;
          if (shortIdSet.has(item.videoId)) stats.shorts.likes += 1;
          else if (musicIdSet.has(item.videoId)) stats.music.likes += 1;
          else stats.videos.likes += 1;
        }
        exclusiveStartKey = likesResult.LastEvaluatedKey as
          | Record<string, unknown>
          | undefined;
      } while (exclusiveStartKey);
    } catch (err) {
      console.error("Failed to aggregate likes for analytics:", err);
    }
  }

  // 3) Comments — a cheap indexed Query per video, run in parallel. Only
  // counts comments a viewer could actually see: auto-flagged/hidden
  // comments (see app/api/comments/route.ts's own `hidden` filter) are
  // excluded here too, so this number matches what's really on the video.
  const commentCounts = await Promise.all(
    allVideos.map(async (v) => {
      try {
        const res = await docClient.send(
          new QueryCommand({
            TableName: "InPlayer-Comments",
            KeyConditionExpression: "videoId = :videoId",
            // `hidden` is a RESERVED WORD in DynamoDB, so it cannot appear
            // literally in an expression — doing so fails the whole query
            // with "Invalid FilterExpression: Attribute name is a reserved
            // keyword". Every one of these queries was throwing, the catch
            // below swallowed it to a count of 0, and creator analytics
            // therefore reported ZERO comments on every video for every
            // creator. Aliasing the name is the documented fix.
            FilterExpression:
              "attribute_not_exists(#hidden) OR #hidden = :notHidden",
            ExpressionAttributeNames: { "#hidden": "hidden" },
            ExpressionAttributeValues: {
              ":videoId": v.videoId,
              ":notHidden": false,
            },
            Select: "COUNT",
          })
        );
        return { videoId: v.videoId, count: res.Count || 0 };
      } catch (err) {
        console.error("Failed to count comments for", v.videoId, err);
        return { videoId: v.videoId, count: 0 };
      }
    })
  );
  for (const c of commentCounts) {
    if (shortIdSet.has(c.videoId)) stats.shorts.comments += c.count;
    else if (musicIdSet.has(c.videoId)) stats.music.comments += c.count;
    else stats.videos.comments += c.count;
  }

  // 4) Subscriber count — same query SubscribeButton uses, just for this
  // creator's own channel.
  let subscriberCount = 0;
  try {
    const subsResult = await docClient.send(
      new QueryCommand({
        TableName: "InPlayer-Subscriptions",
        IndexName: "creatorId-index",
        KeyConditionExpression: "creatorId = :creatorId",
        ExpressionAttributeValues: { ":creatorId": user.userId },
        Select: "COUNT",
      })
    );
    subscriberCount = subsResult.Count || 0;
  } catch (err) {
    console.error("Failed to load subscriber count for analytics:", err);
  }

  // 5) Daily trend snapshot — lazily written once per day per creator, so
  // the graph starts real and accurate from today and grows one honest
  // point per day. No backfilled/fake history for days before this shipped.
  // Needs the InPlayer-Channel-Daily-Stats table to exist (userId partition
  // key, date sort key) — if it doesn't yet, the rest of this response is
  // still fully real; only the trend arrays come back empty.
  let trend: { videos: TrendPoint[]; shorts: TrendPoint[]; music: TrendPoint[] } = {
    videos: [],
    shorts: [],
    music: [],
  };
  let trendAvailable = true;

  try {
    const today = todayKey();
    await docClient.send(
      new PutCommand({
        TableName: DAILY_STATS_TABLE,
        Item: {
          userId: user.userId,
          date: today,
          videoViews: stats.videos.views,
          videoLikes: stats.videos.likes,
          videoComments: stats.videos.comments,
          videoShares: stats.videos.shares,
          shortViews: stats.shorts.views,
          shortLikes: stats.shorts.likes,
          shortComments: stats.shorts.comments,
          shortShares: stats.shorts.shares,
          // New attributes on an existing item — DynamoDB is schemaless,
          // so days recorded before music shipped simply won't have them
          // and read back as 0 below. Nothing needs migrating.
          musicViews: stats.music.views,
          musicLikes: stats.music.likes,
          musicComments: stats.music.comments,
          musicShares: stats.music.shares,
          subscriberCount,
          recordedAt: new Date().toISOString(),
        },
      })
    );

    const since = new Date();
    since.setDate(since.getDate() - TREND_DAYS);
    const sinceKey = since.toISOString().slice(0, 10);

    const snapResult = await docClient.send(
      new QueryCommand({
        TableName: DAILY_STATS_TABLE,
        KeyConditionExpression: "userId = :u AND #d >= :since",
        ExpressionAttributeNames: { "#d": "date" },
        ExpressionAttributeValues: { ":u": user.userId, ":since": sinceKey },
      })
    );

    const points = (snapResult.Items || []).sort((a, b) =>
      a.date < b.date ? -1 : 1
    );
    trend = {
      videos: points.map((p) => ({
        date: p.date as string,
        views: (p.videoViews as number) || 0,
        likes: (p.videoLikes as number) || 0,
        comments: (p.videoComments as number) || 0,
        shares: (p.videoShares as number) || 0,
      })),
      shorts: points.map((p) => ({
        date: p.date as string,
        views: (p.shortViews as number) || 0,
        likes: (p.shortLikes as number) || 0,
        comments: (p.shortComments as number) || 0,
        shares: (p.shortShares as number) || 0,
      })),
      music: points.map((p) => ({
        date: p.date as string,
        views: (p.musicViews as number) || 0,
        likes: (p.musicLikes as number) || 0,
        comments: (p.musicComments as number) || 0,
        shares: (p.musicShares as number) || 0,
      })),
    };
  } catch (err) {
    console.error(
      "Daily stats table unavailable — trend charts will show a setup state:",
      err
    );
    trendAvailable = false;
  }

  return NextResponse.json({
    videos: stats.videos,
    shorts: stats.shorts,
    music: stats.music,
    subscriberCount,
    trend,
    trendAvailable,
  });
}
