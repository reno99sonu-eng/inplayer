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
  } catch (error: any) {
    console.error("Error in GET /api/raftaar-films/apply:", error?.name, error?.message, error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
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
    const channelName = body.channelName?.trim();
    const personalName = body.personalName?.trim() || body.legalName?.trim();
    const username = body.username?.trim() || body.handle?.trim();
    const phoneNumber = body.phoneNumber?.trim() || body.phone?.trim();
    const email = body.email?.trim();
    const companyName = body.companyName?.trim() || undefined;

    if (!channelName || !personalName || !username || !phoneNumber || !email) {
      return NextResponse.json(
        { error: "Channel name, personal name, username, phone number, and email are required." },
        { status: 400 }
      );
    }

    const application = await submitApplication({
      userId: auth.userId,
      channelName,
      personalName,
      username,
      phoneNumber,
      email,
      companyName,
    });

    return NextResponse.json({ application }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/raftaar-films/apply:", error?.name, error?.message, error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}

