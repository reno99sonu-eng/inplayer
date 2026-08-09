import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { after } from "next/server";
import { docClient } from "@/app/lib/dynamodb";
import { resolveUsernames } from "@/app/lib/resolveUsernames";
import BackButton from "@/app/components/BackButton";
import IVSPlayer from "@/app/components/IVSPlayer";
import Link from "next/link";
import Image from "next/image";
import CommentSection from "@/app/components/CommentSection";
import SubscribeButton from "@/app/components/SubscribeButton";
import ReportButton from "@/app/components/ReportButton";
import ShareButton from "@/app/components/ShareButton";
import LikeButton from "@/app/components/LikeButton";
import { Eye, Clock } from "lucide-react";
import { formatTimeAgo } from "@/app/lib/formatters";

export const dynamic = "force-dynamic";

interface LiveViewerPageProps {
  params: Promise<{ videoId: string }>;
}

export default async function LiveViewerPage({ params }: LiveViewerPageProps) {
  const { videoId } = await params;

  const result = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
    })
  );

  const video = result.Item;

  if (!video || video.moderationHidden === true) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center lg:px-6">
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          Live stream not found
        </h2>
        <p className="mt-1.5 text-sm text-slate-400 light:text-slate-600 lg:mt-2">
          This stream doesn&apos;t exist or has ended.
        </p>
        <Link
          href="/"
          className="mt-4 rounded-2xl border border-white/10 light:border-black/10 px-5 py-2 text-sm font-semibold text-slate-200 light:text-slate-700 transition hover:border-orange-400/30 hover:bg-white/5 light:hover:bg-black/5 lg:mt-6 lg:px-6 lg:py-2.5"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  // If it's VOD now, redirect to the normal watch page
  if (video.status !== "live") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center lg:px-6">
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          This live stream has ended
        </h2>
        <p className="mt-1.5 text-sm text-slate-400 light:text-slate-600 lg:mt-2">
          You can watch the recorded video now.
        </p>
        <Link
          href={`/watch/${videoId}`}
          className="mt-4 rounded-2xl bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 lg:mt-6 lg:px-6 lg:py-2.5"
        >
          Watch Video
        </Link>
      </div>
    );
  }

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

  const [uploaderUsernameMap] = await Promise.all([
    resolveUsernames([video.uploaderId])
  ]);
  const uploaderUsername = uploaderUsernameMap.get(video.uploaderId) || "unknown";

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 lg:px-4 lg:py-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        {/* Left Column: Player & Info */}
        <div className="flex min-w-0 flex-col gap-6">
          <IVSPlayer streamUrl={video.playbackUrl}>
            <div className="absolute top-4 left-4 z-10">
              <BackButton />
            </div>
          </IVSPlayer>

          <div className="flex flex-col gap-4">
            <h1 className="text-xl font-bold text-white light:text-slate-900 sm:text-2xl">
              {video.title}
            </h1>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Channel Info */}
              <div className="flex items-center gap-3">
                <Link
                  href={`/@${uploaderUsername}`}
                  className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5 light:border-black/10 light:bg-black/5"
                >
                  <Image
                    src={video.uploaderAvatarUrl || `https://api.dicebear.com/9.x/glass/svg?seed=${video.uploaderId}`}
                    alt={video.uploaderName}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </Link>
                <div className="flex flex-col">
                  <Link
                    href={`/@${uploaderUsername}`}
                    className="font-bold text-white transition-colors hover:text-orange-400 light:text-slate-900 light:hover:text-orange-500"
                  >
                    {video.uploaderName}
                  </Link>
                  <span className="text-xs text-slate-400 light:text-slate-600">
                    @{uploaderUsername}
                  </span>
                </div>
                <div className="ml-2">
                  <SubscribeButton creatorId={video.uploaderId} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <LikeButton videoId={videoId} />
                <ShareButton videoId={videoId} title={video.title} />
                <ReportButton videoId={videoId} title={video.title} />
              </div>
            </div>

            {/* Description Box */}
            <div className="rounded-2xl bg-white/[0.03] p-4 text-sm text-slate-300 light:bg-black/[0.03] light:text-slate-700">
              <div className="mb-2 flex items-center gap-4 text-xs font-semibold text-slate-200 light:text-slate-800">
                <span className="flex items-center gap-1.5 text-red-500">
                  <Eye size={16} /> LIVE
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={16} /> Started {formatTimeAgo(video.uploadedAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{video.description || "No description provided."}</p>
            </div>
          </div>
        </div>

        {/* Right Column: Live Chat (simulated via standard comments for now) */}
        <div className="flex min-w-0 flex-col">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.02] p-4 light:border-black/10 light:bg-black/[0.02] lg:p-6 sticky top-24">
            <h3 className="mb-4 text-lg font-bold text-white light:text-slate-900">
              Live Chat
            </h3>
            {video.commentsEnabled ? (
              <div className="h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                <CommentSection videoId={videoId} />
              </div>
            ) : (
              <p className="text-sm text-slate-400 light:text-slate-600">
                Chat is disabled for this stream.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
