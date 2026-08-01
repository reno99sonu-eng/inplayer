import Link from "next/link";
import SubscribeButton from "@/app/components/SubscribeButton";
import LikeButton from "@/app/components/LikeButton";
import ShareButton from "@/app/components/ShareButton";
import WatchLaterButton from "@/app/components/WatchLaterButton";
import AddToPlaylistButton from "@/app/components/AddToPlaylistButton";
import VideoOptionsMenu from "@/app/components/watch/VideoOptionsMenu";

interface WatchActionsProps {
  videoId: string;
  title: string;
  contentType?: string;
  downloadStatus?: "unavailable" | "preparing" | "ready" | "errored";
  downloadRenditions?: Record<string, string>;
  uploaderId: string;
  uploaderName: string;
  uploaderUsername?: string;
  uploaderAvatarUrl?: string;
}

export default function WatchActions({
  videoId,
  title,
  contentType,
  downloadStatus,
  downloadRenditions,
  uploaderId,
  uploaderName,
  uploaderUsername,
  uploaderAvatarUrl,
}: WatchActionsProps) {
  const profileHref = uploaderUsername ? `/u/${encodeURIComponent(uploaderUsername)}` : null;

  const avatar = (
    <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-white/15 light:ring-black/10 sm:h-9 sm:w-9">
      {/* eslint-disable-next-line @next/next/no-img-element -- uploader avatars can be data URLs. */}
      <img src={uploaderAvatarUrl || "/avatars/avatar.png"} alt={uploaderName} className="h-full w-full object-cover" />
    </div>
  );

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1 pr-1 sm:gap-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-3">
        {profileHref ? (
          <Link
            href={profileHref}
            title={uploaderName}
            aria-label={`Open ${uploaderName}'s channel`}
            className="flex-shrink-0 transition-transform hover:scale-105"
          >
            {avatar}
          </Link>
        ) : (
          avatar
        )}
        <SubscribeButton creatorId={uploaderId} />
      </div>

      <div className="ml-auto flex flex-shrink-0 items-center gap-1.5 pr-1 sm:gap-3">
        <LikeButton videoId={videoId} />
        <ShareButton videoId={videoId} title={title} />
        <WatchLaterButton videoId={videoId} />
        <AddToPlaylistButton videoId={videoId} />
        <VideoOptionsMenu
          videoId={videoId}
          contentType={contentType}
          downloadStatus={downloadStatus}
          downloadRenditions={downloadRenditions}
        />
      </div>
    </div>
  );
}
