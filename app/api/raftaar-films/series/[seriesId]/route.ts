import { NextRequest, NextResponse } from "next/server";
import { getSeriesById, getSeriesEpisodes } from "@/app/lib/raftaarFilms";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params;

    const series = await getSeriesById(seriesId);
    if (!series) {
      return NextResponse.json({ error: "Series not found" }, { status: 404 });
    }

    const episodes = await getSeriesEpisodes(seriesId);
    const totalViews = Math.max(
      series.totalViews || 0,
      episodes.reduce((acc, ep) => acc + (Number(ep.views) || 0), 0)
    );
    const totalLikes = Math.max(
      series.totalLikes || 0,
      episodes.reduce((acc, ep) => acc + (Number(ep.likeCount ?? ep.likes) || 0), 0)
    );
    const enrichedSeries = {
      ...series,
      totalViews,
      totalLikes,
      episodeCount: Math.max(series.episodeCount || 0, episodes.length),
    };

    return NextResponse.json({ series: enrichedSeries, episodes });
  } catch (error) {
    console.error("Error fetching series details:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
