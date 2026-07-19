import { GetCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import VideoPlayer from "@/app/components/VideoPlayer";
import BackButton from "@/app/components/BackButton";
import SubscribeButton from "@/app/components/SubscribeButton";
import LikeButton from "@/app/components/LikeButton";
import WatchLaterButton from "@/app/components/WatchLaterButton";
import ShareButton from "@/app/components/ShareButton";
import WatchHistoryRecorder from "@/app/components/WatchHistoryRecorder";
import ProcessingStatus from "@/app/components/ProcessingStatus";
import { formatTimeAgo, formatViews } from "@/app/lib/formatters";
import Link from "next/link";
import Image from "next/image";
import DescriptionBox from "@/app/components/DescriptionBox";
import CommentSection from "@/app/components/CommentSection";

export const dynamic = "force-dynamic";

interface WatchPageProps {
  params: Promise<{ videoId: string }>;
}

async function getRelatedVideos(currentVideoId: string, category: string) {
  const result = await docClient.send(
    new ScanCommand({
      TableName: "InPlayer-Videos",
      FilterExpression: "#status = :ready",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":ready": "ready" },
    })
  );

  const items = (result.Items || []).filter(
    (v) => v.videoId !== currentVideoId
  );

  // Same-category videos first, then everything else, newest first within each
  const sameCategory = items.filter((v) => v.category === category);
  const otherCategory = items.filter((v) => v.category !== category);

  const sortByNewest = (a: any, b: any) =>
    new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();

  return [...sameCategory.sort(sortByNewest), ...otherCategory.sort(sortByNewest)].slice(
    0,
    12
  );
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          Video not found
        </h2>
        <p className="mt-2 text-sm text-slate-400 light:text-slate-500">
          This video doesn't exist or may have been removed.
        </p>
        <Link
          href="/videos"
          className="mt-6 rounded-2xl border border-white/10 light:border-black/10 px-6 py-2.5 text-sm font-semibold text-slate-200 light:text-slate-700 transition hover:border-orange-400/30 hover:bg-white/5 light:hover:bg-black/5"
        >
          Back to Videos
        </Link>
      </div>
    );
  }

  if (video.status === "processing") {
    return (
      <div className="mx-auto max-w-[600px] px-6 py-8">
        <BackButton />
        <ProcessingStatus videoId={videoId} autoRefreshOnReady />
      </div>
    );
  }

  if (video.status === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <BackButton />
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          Processing failed
        </h2>
        <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-500">
          Something went wrong processing this video. Please try uploading again.
        </p>
      </div>
    );
  }

  // Increment the view count. A simple "views += 1 on page load" — not
  // unique-visitor tracking, but an honest, simple starting point.
  await docClient.send(
    new UpdateCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
      UpdateExpression: "SET #views = if_not_exists(#views, :zero) + :inc",
      ExpressionAttributeNames: { "#views": "views" },
      ExpressionAttributeValues: { ":inc": 1, ":zero": 0 },
    })
  );

  const relatedVideos = await getRelatedVideos(videoId, video.category);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:py-8">
      <BackButton />
      <WatchHistoryRecorder videoId={videoId} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left column — player + info */}
        <div className="min-w-0">
          <VideoPlayer
            playbackId={video.muxPlaybackId}
            title={video.title}
            videoId={videoId}
          />

          <h1 className="mt-4 text-xl sm:text-2xl font-black leading-tight text-white light:text-slate-900">
            {video.title}
          </h1>

          <p className="mt-1.5 text-sm text-slate-400 light:text-slate-500">
            {formatViews(video.views || 0)} • {formatTimeAgo(video.uploadedAt)}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-y border-white/10 light:border-black/10 py-4">
            <div className="flex items-center gap-3">
              <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-white/10 light:border-black/10">
                <Image
                  src="/avatars/avatar.png"
                  alt={video.uploaderName}
                  fill
                  sizes="44px"
                  className="object-cover"
                />
              </div>

              <p className="font-semibold text-white light:text-slate-900">
                {video.uploaderName}
              </p>

              <SubscribeButton creatorId={video.uploaderId} />
            </div>

            <div className="flex items-center gap-2">
              <LikeButton videoId={videoId} />
              <WatchLaterButton videoId={videoId} />
              <ShareButton videoId={videoId} title={video.title} />

              <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-300 light:text-orange-700">
                {video.category}
              </span>
            </div>
          </div>

          {video.description && <DescriptionBox description={video.description} />}

          <CommentSection videoId={videoId} />
        </div>

        {/* Right column — related videos */}
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400 light:text-slate-500">
            Up Next
          </h2>

          <div className="space-y-1">
            {relatedVideos.length === 0 ? (
              <p className="text-sm text-slate-500">No other videos yet.</p>
            ) : (
              relatedVideos.map((related) => (
                <Link
                  key={related.videoId}
                  href={`/watch/${related.videoId}`}
                  className="group flex gap-3 rounded-xl p-2 -mx-2 transition-colors hover:bg-white/5 light:hover:bg-black/5"
                >
                  <div className="relative h-[80px] w-[140px] flex-shrink-0 overflow-hidden rounded-xl bg-white/5 light:bg-black/5">
                    {related.thumbnailUrl && (
                      <Image
                        src={related.thumbnailUrl}
                        alt={related.title}
                        fill
                        sizes="140px"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-sm font-semibold text-white light:text-slate-900 group-hover:text-orange-300 light:group-hover:text-orange-600 transition-colors">
                      {related.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
                      {related.uploaderName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatViews(related.views || 0)} • {formatTimeAgo(related.uploadedAt)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
