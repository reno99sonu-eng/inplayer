import Link from "next/link";
import SubscribeButton from "@/app/components/SubscribeButton";
import LikeButton from "@/app/components/LikeButton";
import ShareButton from "@/app/components/ShareButton";
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

// One YouTube-style line directly under the video (videos only — Shorts
// have their own separate action rail): the channel avatar, In-Family
// (InPlayer's Subscribe), Like/Dislike, Share, and a three-dot "more"
// menu. The creator's avatar/name + In-Family already appear once above
// the player in WatchHero — this is a second, deliberate appearance
// directly under the video, exactly where YouTube puts its own
// channel-and-actions row. Never wraps to a second line: on narrow
// screens the row scrolls horizontally instead, so it's always genuinely
// one line like the user asked for.
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
    <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-white/15 light:ring-black/10">
      {/* eslint-disable-next-line @next/next/no-img-element -- uploader avatars can be data URLs. */}
      <img src={uploaderAvatarUrl || "/avatars/avatar.png"} alt={uploaderName} className="h-full w-full object-cover" />
    </div>
  );

  return (
    <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex flex-shrink-0 items-center gap-2">
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

      <div className="flex flex-shrink-0 items-center gap-2 lg:ml-auto">
        <LikeButton videoId={videoId} />
        <ShareButton videoId={videoId} title={title} />
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
