import type { Metadata } from "next";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { after } from "next/server";
import { docClient } from "@/app/lib/dynamodb";
import { getVisibleVideos, getAudienceMode } from "@/app/lib/contentAccessServer";
import { isVideoVisible, videoAudience } from "@/app/lib/contentAccess";
import { buildVideoJsonLd, serializeJsonLd } from "@/app/lib/videoSchema";
import { Lock } from "lucide-react";
import { resolveUsernames } from "@/app/lib/resolveUsernames";
import BackButton from "@/app/components/BackButton";
import WatchHistoryRecorder from "@/app/components/WatchHistoryRecorder";
import ProcessingStatus from "@/app/components/ProcessingStatus";
import WatchPageContent from "@/app/components/WatchPageContent";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface WatchPageProps {
  params: Promise<{ videoId: string }>;
}

// Every watch page used to render with the exact same generic "INPLAYER"
// title/description regardless of which video was open — real content,
// zero per-page search-result signal. This gives each one its own title
// (via the root layout's "%s | INPLAYER" template — see app/layout.tsx),
// description, and self-referencing canonical URL, the same missing piece
// documented in the project log's SEO entry. A separate, cheap GetItem
// (not the paginated Scan the page body uses) — safe to fail independently
// of the page itself ever loading.
export async function generateMetadata({
  params,
}: WatchPageProps): Promise<Metadata> {
  const { videoId } = await params;

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId },
      })
    );
    const video = result.Item;

    if (!video || video.moderationHidden === true) {
      return { title: "Video not found" };
    }

    const title = (video.title as string)?.trim() || "Watch on INPLAYER";
    const rawDescription = (video.description as string)?.trim();
    const description = rawDescription
      ? rawDescription.slice(0, 160)
      : `Watch "${title}" on INPLAYER.`;

    return {
      title,
      description,
      alternates: { canonical: `/watch/${videoId}` },
      openGraph: {
        type: "video.other",
        title,
        description,
        // Only ever the stored thumbnail field, never derived from
        // muxPlaybackId here — a members-only video's playback ID must
        // never end up in publicly-crawlable page metadata (see the same
        // restriction already applied to muxPlaybackId further down in
        // this file, in the actual page body).
        images: video.thumbnailUrl ? [video.thumbnailUrl as string] : undefined,
      },
    };
  } catch (err) {
    console.error("generateMetadata: failed to load video for watch page:", err);
    return { title: "Watch on INPLAYER" };
  }
}

async function getRelatedVideos(currentVideoId: string, category: string) {
  // Shared 30-second cached list (see lib/videoStore) — no per-request
  // table Scan, and it arrives pre-sorted newest-first, so same-category
  // and other-category groups keep their newest-first order for free.
  // Videos only — Shorts have their own dedicated feed and never belong in
  // this "Up Next" list. This is the SSR fallback shown before (and if)
  // the client-side personalized fetch in WatchPageContent replaces it —
  // see app/api/videos/related.
  const items = (await getVisibleVideos()).filter(
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
    notFound();
  }

  // The hard gate. Filtering the listings keeps 18+ content out of every
  // feed, but a direct link would still play it — so the same rule is
  // re-applied here, server-side, before any playback ID or Mux token is
  // ever put into the page. This is what makes the Settings lock real
  // rather than cosmetic: without the passkey there is no request that
  // returns this video's playable details at all.
  const audienceMode = await getAudienceMode();
  if (!isVideoVisible(video, audienceMode)) {
    const isAdultBlock = videoAudience(video) === "adult";
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center lg:px-6">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-orange-400/30 bg-orange-500/10">
          <Lock size={26} className="text-orange-300" />
        </div>
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          {isAdultBlock ? "This video is 18+" : "Not available in Kids mode"}
        </h2>
        <p className="mt-1.5 max-w-sm text-sm text-slate-400 light:text-slate-600 lg:mt-2">
          {isAdultBlock
            ? "Your content settings are currently hiding 18+ videos. Turn 18+ content on in Settings with your 6-digit passkey to watch this."
            : "Kids-only mode is on, so only videos marked for kids can play. Change this in Settings with your 6-digit passkey."}
        </p>
        <Link
          href="/settings"
          className="mt-4 rounded-2xl border border-white/10 light:border-black/10 px-5 py-2 text-sm font-semibold text-slate-200 light:text-slate-700 transition hover:border-orange-400/30 hover:bg-white/5 light:hover:bg-black/5 lg:mt-6 lg:px-6 lg:py-2.5"
        >
          Open Settings
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

  // VideoObject structured data. Search Console reported "Discovered
  // videos: 0" across the whole sitemap and "No video indexed" — with no
  // markup, Google has no way to show a thumbnail, a duration badge or a
  // play affordance beside an InPlayer result, which is what actually earns
  // the click on a video search.
  //
  // Deliberately built HERE rather than in generateMetadata, past every gate
  // above: by this line the video is known to exist, be un-moderated, to
  // have finished processing, and to be visible to THIS request's audience
  // mode. So the markup can only ever describe a video that is genuinely on
  // the page Google received. buildVideoJsonLd additionally refuses
  // members-only and 18+ videos outright — see its own comment for why each
  // is unsafe.
  const videoJsonLd = buildVideoJsonLd({
    videoId,
    title: video.title,
    description: video.description,
    uploadedAt: video.uploadedAt,
    duration: video.duration,
    views: video.views,
    thumbnailUrl: video.thumbnailUrl,
    // Same withholding rule as the player below: never publish a
    // members-only video's public playback ID.
    muxPlaybackId: video.membersOnly ? undefined : video.muxPlaybackId,
    contentType: video.contentType,
    uploaderName: video.uploaderName,
    uploaderUsername,
    membersOnly: !!video.membersOnly,
    audience: videoAudience(video),
  });

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 lg:px-4 lg:py-8">
      {videoJsonLd && (
        <script
          type="application/ld+json"
          // serializeJsonLd, not JSON.stringify: the title and description
          // are creator-supplied, and JSON.stringify leaves "<" intact — a
          // video titled "</script><script>..." would otherwise break out
          // of this block and run as page script. See videoSchema.ts.
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(videoJsonLd) }}
        />
      )}

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
          // Music-only extras. Undefined on a video, and MusicStage is
          // never rendered for one, so this costs nothing there.
          covers: (video.covers as string[] | undefined) || undefined,
          coverIntervalSeconds: (video.coverIntervalSeconds as number | undefined) || undefined,
          lyrics: (video.lyrics as { time: number; text: string }[] | undefined) || undefined,
          downloadStatus: video.downloadStatus || "unavailable",
          downloadRenditions: video.downloadRenditions || {},
          tags: video.tags || [],
          commentsEnabled: video.commentsEnabled,
          ageRestricted: video.ageRestricted,
          // Background soundtrack + "Look" filter, picked at upload time —
          // stored under the shared shortSettings attribute regardless of
          // contentType (see app/api/upload/create/route.ts). Undefined for
          // every video published before this feature existed.
          soundtrack: video.shortSettings?.soundtrack || null,
          filterLook: video.shortSettings?.filter,
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
