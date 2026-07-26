import LikeButton from "@/app/components/LikeButton";
import WatchLaterButton from "@/app/components/WatchLaterButton";
import ShareButton from "@/app/components/ShareButton";
import DownloadButton from "@/app/components/DownloadButton";
import AddToPlaylistButton from "@/app/components/AddToPlaylistButton";

interface WatchActionsProps {
  videoId: string;
  title: string;
  contentType?: string;
  downloadStatus?: "unavailable" | "preparing" | "ready" | "errored";
  downloadRenditions?: Record<string, string>;
}

export default function WatchActions({
  videoId,
  title,
  contentType,
  downloadStatus,
  downloadRenditions,
}: WatchActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <LikeButton videoId={videoId} />
      <ShareButton videoId={videoId} title={title} />
      <WatchLaterButton videoId={videoId} />
      <AddToPlaylistButton videoId={videoId} />
      {contentType !== "short" && <DownloadButton videoId={videoId} initialStatus={downloadStatus || "unavailable"} initialRenditions={downloadRenditions || {}} />}
    </div>
  );
}
