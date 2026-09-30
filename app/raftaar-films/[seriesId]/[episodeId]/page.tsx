import { notFound } from "next/navigation";
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
    return notFound();
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
