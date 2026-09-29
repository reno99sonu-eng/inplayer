import { notFound } from "next/navigation";
import FilmPlayerContent from "@/app/components/raftaar-films/FilmPlayerContent";
import { getSeriesById, getSeriesEpisodes } from "@/app/lib/raftaarFilms";

export const dynamic = "force-dynamic";

export default async function FilmPlayerPage({
  params,
}: {
  params: Promise<{ seriesId: string; episodeId: string }>;
}) {
  const { seriesId, episodeId } = await params;

  const [series, episodes] = await Promise.all([
    getSeriesById(seriesId).catch(() => null),
    getSeriesEpisodes(seriesId).catch(() => []),
  ]);

  if (!series) {
    return notFound();
  }

  return (
    <FilmPlayerContent
      series={series}
      episodes={episodes}
      currentEpisodeId={episodeId}
    />
  );
}
