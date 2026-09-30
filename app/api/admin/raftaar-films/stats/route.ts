import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { docClient } from "@/app/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { FILM_SERIES_TABLE, FILM_APPLICATIONS_TABLE } from "@/app/lib/raftaarFilms";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Total Series
    const seriesResult = await docClient.send(
      new ScanCommand({
        TableName: FILM_SERIES_TABLE,
        Select: "COUNT",
      })
    );
    const totalSeries = seriesResult.Count || 0;

    // 2. Pending Applications
    const appsResult = await docClient.send(
      new ScanCommand({
        TableName: FILM_APPLICATIONS_TABLE,
        FilterExpression: "#status = :status",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": "pending",
        },
        Select: "COUNT",
      })
    );

    const pendingApplications = appsResult.Count || 0;

    // 3. Total Episodes, Views & Likes (InPlayer-Videos where contentType='film' or attribute_exists(seriesId))
    const episodes: any[] = [];
    let exclusiveStartKey: Record<string, any> | undefined;

    do {
      const vResult = await docClient.send(
        new ScanCommand({
          TableName: "InPlayer-Videos",
          FilterExpression: "contentType = :type OR attribute_exists(seriesId)",
          ExpressionAttributeValues: { ":type": "film" },
          ProjectionExpression: "videoId, seriesId, #v, #l, likeCount",
          ExpressionAttributeNames: { "#v": "views", "#l": "likes" },
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      if (vResult.Items) {
        episodes.push(...vResult.Items);
      }
      exclusiveStartKey = vResult.LastEvaluatedKey;
    } while (exclusiveStartKey);

    const totalEpisodes = episodes.length;
    const totalFilmViews = episodes.reduce((acc, ep) => acc + (Number(ep.views) || 0), 0);
    const totalFilmLikes = episodes.reduce((acc, ep) => acc + (Number(ep.likeCount ?? ep.likes) || 0), 0);

    return NextResponse.json({
      totalSeries,
      totalEpisodes,
      pendingApplications,
      totalFilmViews,
      totalFilmLikes,
    });
  } catch (err) {
    console.error("Failed to fetch stats:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
