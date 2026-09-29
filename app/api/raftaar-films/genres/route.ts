import { NextRequest, NextResponse } from "next/server";
import { getFilmGenresWithCounts } from "@/app/lib/raftaarFilms";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const genres = await getFilmGenresWithCounts();
    return NextResponse.json({ genres });
  } catch (error) {
    console.error("Error fetching genres:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
