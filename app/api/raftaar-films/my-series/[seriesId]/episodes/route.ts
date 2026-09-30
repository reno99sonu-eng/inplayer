import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getSeriesById } from "@/app/lib/raftaarFilms";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ seriesId: string }> }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { seriesId } = await params;
    
    // Verify series exists and belongs to user
    const series = await getSeriesById(seriesId);
    if (!series) {
      return NextResponse.json({ error: "Series not found" }, { status: 404 });
    }
    
    if (series.creatorId !== auth.userId) {
      return NextResponse.json({ error: "Forbidden: You don't own this series" }, { status: 403 });
    }


    const body = await request.json();
    const { episodeTitle, episodeNumber, seasonNumber } = body;

    return NextResponse.json({ 
      seriesId, 
      episodeNumber, 
      seasonNumber, 
      episodeTitle 
    }, { status: 200 });
  } catch (error) {
    console.error("Error in POST /api/raftaar-films/my-series/[seriesId]/episodes:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
