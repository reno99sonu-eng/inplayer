import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { isSubscribedToSeries, subscribeToSeries, unsubscribeFromSeries } from "@/app/lib/raftaarFilms";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ seriesId: string }> }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { seriesId } = await params;
    const subscribed = await isSubscribedToSeries(seriesId, auth.userId);
    
    return NextResponse.json({ subscribed });
  } catch (error) {
    console.error("Error in GET /api/raftaar-films/series/[seriesId]/subscribe:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ seriesId: string }> }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { seriesId } = await params;
    const body = await request.json();
    
    let subscribed = false;
    
    if (body.action === "subscribe") {
      await subscribeToSeries(seriesId, auth.userId);
      subscribed = true;
    } else if (body.action === "unsubscribe") {
      await unsubscribeFromSeries(seriesId, auth.userId);
      subscribed = false;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ subscribed }, { status: 200 });
  } catch (error) {
    console.error("Error in POST /api/raftaar-films/series/[seriesId]/subscribe:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
