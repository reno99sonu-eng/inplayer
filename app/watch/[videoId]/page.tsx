import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import VideoPlayer from "@/app/components/VideoPlayer";
import Link from "next/link";

// Always fetch fresh — a video's status/details can change (e.g. views
// incrementing), so this page shouldn't be statically cached forever.
export const dynamic = "force-dynamic";

interface WatchPageProps {
  params: Promise<{ videoId: string }>;
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
          href="/"
          className="mt-6 rounded-2xl border border-white/10 light:border-black/10 px-6 py-2.5 text-sm font-semibold text-slate-200 light:text-slate-700 transition hover:border-orange-400/30 hover:bg-white/5 light:hover:bg-black/5"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  if (video.status === "processing") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          Still processing
        </h2>
        <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-500">
          "{video.title}" is still being processed. Check back in a few minutes.
        </p>
      </div>
    );
  }

  if (video.status === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          Processing failed
        </h2>
        <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-500">
          Something went wrong processing this video. Please try uploading again.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 sm:py-10">
      <VideoPlayer
        playbackId={video.muxPlaybackId}
        title={video.title}
        videoId={videoId}
      />

      <div className="mt-5">
        <h1 className="text-xl sm:text-2xl font-black text-white light:text-slate-900">
          {video.title}
        </h1>

        <div className="mt-2 flex items-center gap-3 text-sm text-slate-400 light:text-slate-500">
          <span>{video.uploaderName}</span>
          <span>•</span>
          <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-300 light:text-orange-700">
            {video.category}
          </span>
        </div>

        {video.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-300 light:text-slate-600">
            {video.description}
          </p>
        )}
      </div>
    </div>
  );
}
