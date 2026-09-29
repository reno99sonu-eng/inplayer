import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getApplicationByUserId, submitApplication } from "@/app/lib/raftaarFilms";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const application = await getApplicationByUserId(auth.userId);
    return NextResponse.json({ application: application || null });
  } catch (error) {
    console.error("Error in GET /api/raftaar-films/apply:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingApp = await getApplicationByUserId(auth.userId);
    if (existingApp) {
      return NextResponse.json({ error: "Application already exists" }, { status: 409 });
    }

    const body = await request.json();
    const application = await submitApplication({
      ...body,
      userId: auth.userId,
    });

    return NextResponse.json({ application }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/raftaar-films/apply:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
