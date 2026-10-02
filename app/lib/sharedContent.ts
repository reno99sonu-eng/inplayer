import { GetCommand } from "@aws-sdk/lib-dynamodb";

import { getAudienceMode, getVisibleVideos } from "@/app/lib/contentAccessServer";
import { isVideoVisible } from "@/app/lib/contentAccess";
import { docClient } from "@/app/lib/dynamodb";

type VideoRecord = Record<string, unknown>;

function isShareableVideo(video: VideoRecord): boolean {
  const visibility = video.visibility;
  const allowedVisibility =
    visibility == null || visibility === "public" || visibility === "unlisted";

  return (
    video.status === "ready" &&
    typeof video.muxPlaybackId === "string" &&
    video.muxPlaybackId.trim().length > 0 &&
    video.moderationHidden !== true &&
    allowedVisibility
  );
}

/**
 * Resolve a link to a playable, audience-visible video. Ready items normally
 * come from the shared cache; a gated item read covers fresh links before the
 * cache catches up without exposing processing or audience-hidden content.
 */
export async function getShareableVideoById(
  videoId: string,
): Promise<VideoRecord | null> {
  const visibleVideos = await getVisibleVideos();
  const cachedVideo = visibleVideos.find((video) => video.videoId === videoId);
  if (cachedVideo) {
    return isShareableVideo(cachedVideo) ? cachedVideo : null;
  }

  const response = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
    }),
  );
  const video = response.Item as VideoRecord | undefined;
  if (!video || !isShareableVideo(video)) return null;

  const audienceMode = await getAudienceMode();
  return isVideoVisible(video, audienceMode) ? video : null;
}
