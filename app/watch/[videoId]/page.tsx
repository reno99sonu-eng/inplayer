import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { after } from "next/server";
import { docClient } from "@/app/lib/dynamodb";
import { getReadyVideos } from "@/app/lib/videoStore";
import { resolveUsernames } from "@/app/lib/resolveUsernames";
import BackButton from "@/app/components/BackButton";
import WatchHistoryRecorder from "@/app/components/WatchHistoryRecorder";
import ProcessingStatus from "@/app/components/ProcessingStatus";
import WatchPageContent from "@/app/components/WatchPageContent";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface WatchPageProps {
  params: Promise<{ videoId: string }>;
}

async function getRelatedVideos(currentVideoId: string, category: string) {
  // Shared 30-second cached list (see lib/videoStore) — no per-request
  // table Scan, and it arrives pre-sorted newest-first, so same-category
  // and other-category groups keep their newest-first order for free.
  // Videos only — Shorts have their own dedicated feed and never belong in
  // this "Up Next" list. This is the SSR fallback shown before (and if)
  // the client-side personalized fetch in WatchPageContent replaces it —
  // see app/api/videos/related.
  const items = (await getReadyVideos()).filter(
    (v) =>
      v.videoId !== currentVideoId &&
      v.contentType !== "short" &&
      (!v.visibility || v.visibility === "public")
  );

  const sameCategory = items.filter((v) => v.category === category);
  const otherCategory = items.filter((v) => v.category !== category);

  return [...sameCategory, ...otherCategory].slice(0, 12);
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { videoId } = await params;

  const result = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
    })
  );

  const video = result.Item;

  // Auto-flagged at upload (app/lib/moderation.ts) and awaiting admin
  // review — treated exactly like "not found" for a direct link, same as
  // it already is everywhere this video would otherwise be listed (see
  // app/lib/videoStore.ts).
  if (!video || video.moderationHidden === true) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center lg:px-6">
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          Video not found
        </h2>
        <p className="mt-1.5 text-sm text-slate-400 light:text-slate-600 lg:mt-2">
          This video doesn&apos;t exist or may have been removed.
        </p>
        <Link
          href="/videos"
          className="mt-4 rounded-2xl border border-white/10 light:border-black/10 px-5 py-2 text-sm font-semibold text-slate-200 light:text-slate-700 transition hover:border-orange-400/30 hover:bg-white/5 light:hover:bg-black/5 lg:mt-6 lg:px-6 lg:py-2.5"
        >
          Back to Videos
        </Link>
      </div>
    );
  }

  if (video.status === "processing") {
    return (
      <div className="mx-auto max-w-[600px] px-4 py-5 lg:px-6 lg:py-8">
        <BackButton />
        <ProcessingStatus videoId={videoId} autoRefreshOnReady />
      </div>
    );
  }

  if (video.status === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center lg:px-6">
        <BackButton />
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          Processing failed
        </h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-400 light:text-slate-600 lg:mt-2">
          Something went wrong processing this video. Please try uploading again.
        </p>
      </div>
    );
  }

  // Increment the view count. A simple "views += 1 on page load" — not
  // unique-visitor tracking, but an honest, simple starting point.
  // Runs AFTER the response is sent (next/server's after) — the viewer
  // shouldn't wait on a database write that has nothing to do with
  // rendering their page. Shaves a full DynamoDB round trip off every
  // watch-page load.
  after(async () => {
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId },
          UpdateExpression: "SET #views = if_not_exists(#views, :zero) + :inc",
          ExpressionAttributeNames: { "#views": "views" },
          ExpressionAttributeValues: { ":inc": 1, ":zero": 0 },
        })
      );
    } catch (err) {
      console.error("Failed to record view:", err);
    }

    // Mirrors the same +1 into today's per-video daily bucket — see
    // app/lib/trendingStore. The all-time counter above can never answer
    // "what's popular *today*"; this is what Trending Now and Featured
    // Weekly actually read from. Independent try/catch from the counter
    // above so one table being unprovisioned never blocks the other.
    try {
      const today = new Date().toISOString().slice(0, 10);
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Video-Daily-Views",
          Key: { date: today, videoId },
          UpdateExpression: "SET #v = if_not_exists(#v, :zero) + :inc",
          ExpressionAttributeNames: { "#v": "views" },
          ExpressionAttributeValues: { ":inc": 1, ":zero": 0 },
        })
      );
    } catch (err) {
      console.error("Failed to record daily view:", err);
    }
  });

  // Resolved server-side so the channel card can link straight to the
  // uploader's real profile with no extra client round trip — see
  // app/lib/resolveUsernames. Run alongside the related-videos fetch
  // rather than after it, so this doesn't add its own serial round trip.
  const [relatedVideos, uploaderUsername] = await Promise.all([
    getRelatedVideos(videoId, video.category),
    resolveUsernames([video.uploaderId]).then((map) =>
      map.get(video.uploaderId)
    ),
  ]);

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 lg:px-4 lg:py-8">
      {/* Desktop/tablet only — removed from the video-playing screen on
          mobile per the current design pass. Untouched for the
          processing/error states above, and for every other BackButton
          usage in the app. */}
      <div className="hidden lg:block">
        <BackButton />
      </div>
      <WatchHistoryRecorder videoId={videoId} />

      <WatchPageContent
        video={{
          videoId,
          title: video.title,
          description: video.description,
          category: video.category,
          uploaderId: video.uploaderId,
          uploaderName: video.uploaderName,
          uploaderUsername,
          uploaderAvatarUrl: video.uploaderAvatarUrl,
          uploadedAt: video.uploadedAt,
          views: video.views || 0,
          // Withheld entirely for a members-only video, regardless of who's
          // requesting the page — this is server-rendered HTML sent to
          // every visitor, member or not, so the real playback ID can
          // never be in it. MembersOnlyVideoPlayer fetches its own,
          // authenticated, only for a viewer who actually qualifies. See
          // app/api/videos/[videoId]/playback-token.
          muxPlaybackId: video.membersOnly ? undefined : video.muxPlaybackId,
          membersOnly: !!video.membersOnly,
          thumbnailUrl: video.thumbnailUrl,
          contentType: video.contentType,
          downloadStatus: video.downloadStatus || "unavailable",
          downloadRenditions: video.downloadRenditions || {},
          tags: video.tags || [],
          commentsEnabled: video.commentsEnabled,
          ageRestricted: video.ageRestricted,
        }}
        relatedVideos={relatedVideos.map((v) => ({
          videoId: v.videoId as string,
          title: v.title as string,
          uploaderName: v.uploaderName as string,
          views: (v.views as number) || 0,
          uploadedAt: v.uploadedAt as string,
          thumbnailUrl: v.thumbnailUrl as string | undefined,
        }))}
      />
    </div>
  );
}
