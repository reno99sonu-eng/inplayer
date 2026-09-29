import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { getSeriesByCreator } from "@/app/lib/raftaarFilms";
import { docClient } from "@/app/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const series = await getSeriesByCreator(auth.userId) || [];
    
    let totalSeries = series.length;
    let totalEpisodes = 0;
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;

    // Fetch episodes for each series to aggregate analytics
    for (const s of series) {
      try {
        const episodesRes = await docClient.send(new ScanCommand({
          TableName: "InPlayer-Videos",
          FilterExpression: "seriesId = :seriesId",
          ExpressionAttributeValues: {
            ":seriesId": s.seriesId
          }
        }));
        
        const episodes = episodesRes.Items || [];
        totalEpisodes += episodes.length;
        
        for (const ep of episodes) {
          totalViews += (ep.views || 0);
          totalLikes += (ep.likes || ep.likeCount || 0);
          totalComments += (ep.comments || ep.commentCount || 0);
        }
      } catch (err) {
        console.error(`Error fetching episodes for series ${s.seriesId}:`, err);
      }
    }

    return NextResponse.json({ 
      analytics: {
        totalSeries,
        totalEpisodes,
        totalViews,
        totalLikes,
        totalComments
      }
    });
  } catch (error) {
    console.error("Error in GET /api/raftaar-films/my-series/analytics:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
