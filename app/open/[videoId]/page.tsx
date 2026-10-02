import { notFound, redirect } from "next/navigation";

import { isMusicType, isShortType } from "@/app/lib/contentTypes";
import { getSeriesById } from "@/app/lib/raftaarFilms";
import { getShareableVideoById } from "@/app/lib/sharedContent";

export const dynamic = "force-dynamic";

export default async function SharedContentPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  const video = await getShareableVideoById(videoId);
  if (!video) notFound();

  if (isShortType(video.contentType)) {
    redirect(`/shorts?v=${encodeURIComponent(videoId)}`);
  }
  if (isMusicType(video.contentType)) {
    redirect(`/music?v=${encodeURIComponent(videoId)}`);
  }

  const seriesId =
    typeof video.seriesId === "string" ? video.seriesId.trim() : "";
  if (seriesId && (await getSeriesById(seriesId).catch(() => null))) {
    redirect(
      `/raftaar-films/${encodeURIComponent(seriesId)}/${encodeURIComponent(videoId)}`,
    );
  }

  // Standard video and unlinked/legacy film fallback. The watch route keeps
  // the video ID and renders the exact item rather than losing it.
  redirect(`/watch/${encodeURIComponent(videoId)}`);
}
