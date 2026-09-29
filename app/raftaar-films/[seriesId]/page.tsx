import { notFound } from "next/navigation";
import SeriesDetailContent from "@/app/components/raftaar-films/SeriesDetailContent";
import { getSeriesById, getSeriesEpisodes } from "@/app/lib/raftaarFilms";

export const dynamic = "force-dynamic";

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;

  const [series, episodes] = await Promise.all([
    getSeriesById(seriesId).catch(() => null),
    getSeriesEpisodes(seriesId).catch(() => []),
  ]);

  if (!series) {
    return notFound();
  }

  return <SeriesDetailContent series={series} episodes={episodes} />;
}
