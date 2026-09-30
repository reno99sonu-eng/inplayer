import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";
import { docClient } from "@/app/lib/dynamodb";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { FILM_SERIES_TABLE } from "@/app/lib/raftaarFilms";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Scan series table
    const result = await docClient.send(
      new ScanCommand({
        TableName: FILM_SERIES_TABLE,
      })
    );
    const series = result.Items || [];

    // Aggregate real-time views and likes per series from InPlayer-Videos
    const seriesStats: Record<string, { views: number; likes: number; count: number }> = {};
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
        for (const ep of vResult.Items) {
          const sId = ep.seriesId;
          if (sId) {
            if (!seriesStats[sId]) {
              seriesStats[sId] = { views: 0, likes: 0, count: 0 };
            }
            seriesStats[sId].count += 1;
            seriesStats[sId].views += (Number(ep.views) || 0);
            seriesStats[sId].likes += (Number(ep.likeCount ?? ep.likes) || 0);
          }
        }
      }
      exclusiveStartKey = vResult.LastEvaluatedKey;
    } while (exclusiveStartKey);

    const enrichedSeries = series.map((s: any) => {
      const st = seriesStats[s.seriesId];
      return {
        ...s,
        totalViews: Math.max(s.totalViews || 0, st?.views || 0),
        totalLikes: Math.max(s.totalLikes || 0, st?.likes || 0),
        episodeCount: st ? st.count : (s.episodeCount || 0),
      };
    });

    return NextResponse.json({ series: enrichedSeries });
  } catch (err) {
    console.error("Failed to list series:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
