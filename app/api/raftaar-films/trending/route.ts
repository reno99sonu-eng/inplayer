import { NextRequest, NextResponse } from "next/server";
import { getTrendingSeries } from "@/app/lib/raftaarFilms";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");

    const series = await getTrendingSeries(limit);
    return NextResponse.json({ series });
  } catch (error) {
    console.error("Error fetching trending series:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
