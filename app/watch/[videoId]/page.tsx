import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { after } from "next/server";
import { docClient } from "@/app/lib/dynamodb";
import { getReadyVideos } from "@/app/lib/videoStore";
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
  const items = (await getReadyVideos()).filter(
    (v) =>
      v.videoId !== currentVideoId &&
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

  if (!video) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center lg:px-6">
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          Video not found
        </h2>
        <p className="mt-1.5 text-sm text-slate-400 light:text-slate-600 lg:mt-2">
          This video doesn't exist or may have been removed.
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
  });

  const relatedVideos = await getRelatedVideos(videoId, video.category);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 lg:px-4 lg:py-8">
      <BackButton />
      <WatchHistoryRecorder videoId={videoId} />

      <WatchPageContent
        video={{
          videoId,
          title: video.title,
          description: video.description,
          category: video.category,
          uploaderId: video.uploaderId,
          uploaderName: video.uploaderName,
          uploaderAvatarUrl: video.uploaderAvatarUrl,
          uploadedAt: video.uploadedAt,
          views: video.views || 0,
          muxPlaybackId: video.muxPlaybackId,
          thumbnailUrl: video.thumbnailUrl,
          contentType: video.contentType,
          downloadStatus: video.downloadStatus || "unavailable",
          downloadRenditions: video.downloadRenditions || {},
          tags: video.tags || [],
          commentsEnabled: video.commentsEnabled,
          ageRestricted: video.ageRestricted,
        }}
        relatedVideos={relatedVideos.map((v) => ({
          videoId: v.videoId,
          title: v.title,
          uploaderName: v.uploaderName,
          views: v.views || 0,
          uploadedAt: v.uploadedAt,
          thumbnailUrl: v.thumbnailUrl,
        }))}
      />
    </div>
  );
}
