import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { docClient } from "@/app/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";

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
        TableName: "InPlayer-RaftaarFilms-Series",
        Select: "COUNT",
      })
    );
    const totalSeries = seriesResult.Count || 0;

    // 2. Pending Applications
    const appsResult = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-RaftaarFilms-Applications",
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

    // 3. Total Episodes & Total Views (InPlayer-Videos where contentType='film')
    const videosResult = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        FilterExpression: "contentType = :type",
        ExpressionAttributeValues: {
          ":type": "film",
        },
      })
    );
    
    const episodes = videosResult.Items || [];
    const totalEpisodes = episodes.length;
    const totalFilmViews = episodes.reduce((acc, ep) => acc + (ep.views || 0), 0);

    return NextResponse.json({
      totalSeries,
      totalEpisodes,
      pendingApplications,
      totalFilmViews,
    });
  } catch (err) {
    console.error("Failed to fetch stats:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
