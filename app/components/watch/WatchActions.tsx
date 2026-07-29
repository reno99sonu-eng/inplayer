import Link from "next/link";
import SubscribeButton from "@/app/components/SubscribeButton";
import LikeButton from "@/app/components/LikeButton";
import ShareButton from "@/app/components/ShareButton";
import WatchLaterButton from "@/app/components/WatchLaterButton";
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
// (InPlayer's Subscribe), Like/Dislike, Share, Save (Watch Later), and a
// three-dot "more" menu — the same row YouTube shows directly beneath its
// own player. Never wraps to a second line: on narrow screens the row
// scrolls horizontally instead, so it's always genuinely one line like
// the user asked for.
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
    // justify-between deliberately avoided here: combined with
    // overflow-x-auto it makes browsers mis-measure the scrollable
    // content on narrow screens, cropping the right-hand group (the
    // three-dot menu) instead of letting you scroll to it. ml-auto on
    // the right group gives the same "pinned to opposite ends" look
    // when everything fits, but degrades to plain left-to-right flow
    // (fully scrollable, nothing clipped) once it doesn't. The trailing
    // pr-1 keeps the last icon from sitting flush against the very
    // edge of the row so it never reads as cut off.
    //
    // Every child button in this row (avatar, SubscribeButton,
    // LikeButton, ShareButton, WatchLaterButton, VideoOptionsMenu) is
    // sized down at this same mobile breakpoint and grows at sm: —
    // together with hiding zero counts (see LikeButton/SubscribeButton),
    // that's what actually gets the whole row to fit in one line on
    // real phone widths (~360px+) without needing the scroll at all.
    // overflow-x-auto stays on purely as a safety net for the rare
    // narrower device or a channel with very large counts — never the
    // primary way this is meant to be seen.
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
