import { NextRequest, NextResponse } from "next/server";
import { getPublishedSeries } from "@/app/lib/raftaarFilms";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const genre = searchParams.get("genre") || undefined;
    const search = searchParams.get("search")?.toLowerCase() || undefined;
    const creatorId = searchParams.get("creatorId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "20");
    const cursor = searchParams.get("cursor") || undefined;

    const result = await getPublishedSeries({ genre, limit, cursor });
    let series = result.series;

    if (search) {
      series = series.filter(s => s.title?.toLowerCase().includes(search));
    }

    if (creatorId) {
      series = series.filter(s => s.creatorId === creatorId);
    }

    return NextResponse.json({
      series,
      nextCursor: result.nextCursor
    });
  } catch (error) {
    console.error("Error fetching series:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
