import { notFound, redirect } from "next/navigation";

import { isShortType } from "@/app/lib/contentTypes";
import { getShareableVideoById } from "@/app/lib/sharedContent";

export const dynamic = "force-dynamic";

/** Compatibility route for previously shared /shorts/{videoId} links. */
export default async function SharedShortPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  const video = await getShareableVideoById(videoId);
  if (!video || !isShortType(video.contentType)) notFound();

  redirect(`/shorts?v=${encodeURIComponent(videoId)}`);
}
