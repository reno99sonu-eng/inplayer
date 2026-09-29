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

    return NextResponse.json({ series, episodes });
  } catch (error) {
    console.error("Error fetching series details:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
