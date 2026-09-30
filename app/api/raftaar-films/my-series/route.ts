import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { isApprovedFilmCreator, getSeriesByCreator, createSeries, getApplicationByUserId, getSeriesEpisodes } from "@/app/lib/raftaarFilms";
import { docClient } from "@/app/lib/dynamodb";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const series = await getSeriesByCreator(auth.userId);
    if (!series || series.length === 0) {
      return NextResponse.json({ series: [] });
    }

    // Live reconcile views, likes, and episode count from InPlayer-Videos
    const enrichedSeries = await Promise.all(
      series.map(async (s) => {
        try {
          const episodes = await getSeriesEpisodes(s.seriesId);
          const liveViews = episodes.reduce((acc, ep) => acc + (Number(ep.views) || 0), 0);
          const liveLikes = episodes.reduce((acc, ep) => acc + (Number(ep.likeCount ?? ep.likes) || 0), 0);
          const episodeCount = episodes.length;

          // Self-heal InPlayer-Film-Series table if counts drifted
          if (
            s.totalViews !== liveViews ||
            s.totalLikes !== liveLikes ||
            s.episodeCount !== episodeCount
          ) {
            void docClient.send(
              new UpdateCommand({
                TableName: "InPlayer-Film-Series",
                Key: { seriesId: s.seriesId },
                UpdateExpression: "SET totalViews = :tv, totalLikes = :tl, episodeCount = :ec",
                ExpressionAttributeValues: {
                  ":tv": liveViews,
                  ":tl": liveLikes,
                  ":ec": episodeCount,
                },
              })
            ).catch(() => {});
          }

          return {
            ...s,
            totalViews: Math.max(s.totalViews || 0, liveViews),
            totalLikes: Math.max(s.totalLikes || 0, liveLikes),
            episodeCount: Math.max(s.episodeCount || 0, episodeCount),
          };
        } catch {
          return s;
        }
      })
    );

    return NextResponse.json({ series: enrichedSeries });
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

    const isApproved = await isApprovedFilmCreator(auth.userId, auth.email);
    if (!isApproved) {
      return NextResponse.json({ error: "Forbidden: Not an approved film creator" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, genre, categories, posterUrl, bannerUrl, visibility, audience, language, releaseSchedule } = body;

    if (!title || !genre) {
      return NextResponse.json({ error: "Title and genre are required" }, { status: 400 });
    }

    // Fetch user profile and application for denormalization (with safe fallback)
    let user: any = null;
    let app: any = null;
    try {
      const [userRes, appRes] = await Promise.all([
        docClient.send(new GetCommand({
          TableName: "InPlayer-Users",
          Key: { userId: auth.userId },
        })),
        getApplicationByUserId(auth.userId).catch(() => null),
      ]);
      user = userRes.Item;
      app = appRes;
    } catch (err) {
      console.warn("Could not fetch user/application profile for series denormalization:", err);
    }

    const resolvedCreatorName =
      app?.channelName ||
      app?.personalName ||
      user?.name ||
      auth.name ||
      "Creator";

    const resolvedCreatorHandle =
      app?.username ||
      user?.username ||
      user?.handle ||
      undefined;

    // Auto-heal InPlayer-Users if name or username was missing
    if ((!user?.name || !user?.username) && (resolvedCreatorName || resolvedCreatorHandle)) {
      try {
        await docClient.send(new UpdateCommand({
          TableName: "InPlayer-Users",
          Key: { userId: auth.userId },
          UpdateExpression: "SET #n = if_not_exists(#n, :name), username = if_not_exists(username, :username)",
          ExpressionAttributeNames: { "#n": "name" },
          ExpressionAttributeValues: {
            ":name": resolvedCreatorName,
            ":username": resolvedCreatorHandle || `creator_${auth.userId.slice(0, 6)}`,
          },
        }));
      } catch (syncErr) {
        console.warn("Auto-heal InPlayer-Users notice:", syncErr);
      }
    }

    const series = await createSeries({
      title: title.trim(),
      description: description ? description.trim() : "",
      genre,
      categories: categories || [genre],
      posterUrl: posterUrl || "",
      bannerUrl: bannerUrl || undefined,
      visibility: visibility || "public",
      audience: audience || "everyone",
      language: language || "en",
      releaseSchedule: releaseSchedule || undefined,
      status: "published",
      creatorId: auth.userId,
      creatorName: resolvedCreatorName,
      creatorAvatarUrl: user?.avatarUrl,
      creatorHandle: resolvedCreatorHandle,
    });
    return NextResponse.json({ series }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/raftaar-films/my-series:", error?.name, error?.message, error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}

