import { notFound, redirect } from "next/navigation";
import FilmPlayerContent from "@/app/components/raftaar-films/FilmPlayerContent";
import { getSeriesById, getSeriesEpisodes } from "@/app/lib/raftaarFilms";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

export const dynamic = "force-dynamic";

export default async function FilmPlayerPage({
  params,
}: {
  params: Promise<{ seriesId: string; episodeId: string }>;
}) {
  const { seriesId, episodeId } = await params;

  const [series, rawEpisodes] = await Promise.all([
    getSeriesById(seriesId).catch(() => null),
    getSeriesEpisodes(seriesId).catch(() => []),
  ]);

  if (!series) {
    if (episodeId) {
      const orphanedEpisode = await docClient.send(
        new GetCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId: episodeId },
        }),
      );
      if (orphanedEpisode.Item) {
        redirect(`/open/${encodeURIComponent(episodeId)}`);
      }
    }
    return notFound();
  }

  // Ensure creatorHandle and creator details match the creator's real InPlayer username
  if (series.creatorId) {
    try {
      const userRes = await docClient.send(
        new GetCommand({
          TableName: "InPlayer-Users",
          Key: { userId: series.creatorId },
          ProjectionExpression: "userId, username, #nameAttr, avatarUrl",
          ExpressionAttributeNames: { "#nameAttr": "name" },
        })
      );
      if (userRes.Item) {
        if (userRes.Item.username) {
          series.creatorHandle = userRes.Item.username;
        }
        if (userRes.Item.name && !series.creatorName) {
          series.creatorName = userRes.Item.name;
        }
        if (userRes.Item.avatarUrl && !series.creatorAvatarUrl) {
          series.creatorAvatarUrl = userRes.Item.avatarUrl;
        }
      }
    } catch (err) {
      console.warn("Could not enrich creator username in FilmPlayerPage:", err);
    }
  }

  const episodes = [...rawEpisodes];
  const foundIndex = episodes.findIndex((ep) => ep.videoId === episodeId);

  // If the episode is not yet returned in the series episodes list (e.g. freshly uploaded),
  // fetch it directly from InPlayer-Videos so playback starts immediately with zero lag.
  if (foundIndex === -1 && episodeId) {
    try {
      const vidResult = await docClient.send(
        new GetCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId: episodeId },
        })
      );
      if (vidResult.Item) {
        episodes.push(vidResult.Item);
      }
    } catch (e) {
      console.error("Direct episode fetch fallback failed:", e);
    }
  }

  return (
    <FilmPlayerContent
      series={series}
      episodes={episodes}
      currentEpisodeId={episodeId}
    />
  );
}
