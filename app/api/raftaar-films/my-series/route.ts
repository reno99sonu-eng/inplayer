import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { isApprovedFilmCreator, getSeriesByCreator, createSeries } from "@/app/lib/raftaarFilms";
import { docClient } from "@/app/lib/dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const series = await getSeriesByCreator(auth.userId);
    return NextResponse.json({ series: series || [] });
  } catch (error) {
    console.error("Error in GET /api/raftaar-films/my-series:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isApproved = await isApprovedFilmCreator(auth.userId);
    if (!isApproved) {
      return NextResponse.json({ error: "Forbidden: Not an approved film creator" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, genre, categories, posterUrl, bannerUrl, visibility, audience, language, releaseSchedule } = body;

    if (!title || !genre) {
      return NextResponse.json({ error: "Title and genre are required" }, { status: 400 });
    }

    // Fetch user profile for denormalization
    const userRes = await docClient.send(new GetCommand({
      TableName: "InPlayer-Users",
      Key: { id: auth.userId }
    }));
    const user = userRes.Item;

    const series = await createSeries({
      title,
      description: description || "",
      genre,
      categories: categories || [genre],
      posterUrl,
      bannerUrl,
      visibility: visibility || "public",
      audience: audience || "everyone",
      language: language || "en",
      releaseSchedule,
      status: "published",
      creatorId: auth.userId,
      creatorName: user?.name || "Creator",
      creatorAvatarUrl: user?.avatarUrl,
      creatorHandle: user?.username,
    });
    return NextResponse.json({ series }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/raftaar-films/my-series:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
