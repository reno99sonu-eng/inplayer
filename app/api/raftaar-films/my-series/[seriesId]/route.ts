import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { updateSeries, deleteSeries } from "@/app/lib/raftaarFilms";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ seriesId: string }> }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { seriesId } = await params;
    const body = await request.json();

    await updateSeries(seriesId, auth.userId, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in PATCH /api/raftaar-films/my-series/[seriesId]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ seriesId: string }> }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { seriesId } = await params;
    await deleteSeries(seriesId, auth.userId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/raftaar-films/my-series/[seriesId]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
