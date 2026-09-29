import { NextRequest, NextResponse } from "next/server";
import { getSeriesEpisodes } from "@/app/lib/raftaarFilms";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params;

    const episodes = await getSeriesEpisodes(seriesId);
    
    // Sort episodes by episodeNumber
    episodes.sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0));

    return NextResponse.json({ episodes });
  } catch (error) {
    console.error("Error fetching series episodes:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
