import { NextRequest, NextResponse } from "next/server";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { selfHealVideoBatch } from "@/app/lib/selfHealVideo";
import { getSeriesByCreator, getSeriesEpisodes } from "@/app/lib/raftaarFilms";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const items: Record<string, any>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const page = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        FilterExpression: "uploaderId = :uid OR userId = :uid OR creatorId = :uid",
        ExpressionAttributeValues: { ":uid": user.userId },
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    items.push(...(page.Items || []));
    exclusiveStartKey = page.LastEvaluatedKey;
  } while (exclusiveStartKey);

  // Guarantee all episodes from the creator's Raftaar Films series are present
  try {
    const seriesList = await getSeriesByCreator(user.userId).catch(() => []);
    if (seriesList.length > 0) {
      const nestedEpisodes = await Promise.all(
        seriesList.map((s) => getSeriesEpisodes(s.seriesId).catch(() => []))
      );
      const allSeriesEpisodes = nestedEpisodes.flat();
      const existingIds = new Set(items.map((i) => i.videoId));
      for (const ep of allSeriesEpisodes) {
        if (ep && ep.videoId && !existingIds.has(ep.videoId)) {
          items.push(ep);
          existingIds.add(ep.videoId);
        }
      }
    }
  } catch (err) {
    console.warn("Series episodes fetch fallback warning in /api/my-videos:", err);
  }

  const healed = await selfHealVideoBatch(items);

  const videos = healed.sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  return NextResponse.json({ videos }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}