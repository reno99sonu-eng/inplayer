import { notFound } from "next/navigation";
import SeriesDetailContent from "@/app/components/raftaar-films/SeriesDetailContent";
import { getSeriesById, getSeriesEpisodes } from "@/app/lib/raftaarFilms";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";

export const dynamic = "force-dynamic";

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;

  const [series, episodes] = await Promise.all([
    getSeriesById(seriesId).catch(() => null),
    getSeriesEpisodes(seriesId).catch(() => []),
  ]);

  if (!series) {
    return notFound();
  }

  // Ensure creatorHandle and creator details match the creator's real InPlayer username
  if (series.creatorId) {
    try {
      const userRes = await docClient.send(
        new GetCommand({
          TableName: "InPlayer-Users",
          Key: { userId: series.creatorId },
          ProjectionExpression: "userId, username, #nameAttr, avatarUrl",
          ExpressionAttributeNames: { "#nameAttr": "name" },
        })
      );
      if (userRes.Item) {
        if (userRes.Item.username) {
          series.creatorHandle = userRes.Item.username;
        }
        if (userRes.Item.name && !series.creatorName) {
          series.creatorName = userRes.Item.name;
        }
        if (userRes.Item.avatarUrl && !series.creatorAvatarUrl) {
          series.creatorAvatarUrl = userRes.Item.avatarUrl;
        }
      }
    } catch (err) {
      console.warn("Could not enrich creator username in SeriesDetailPage:", err);
    }
  }

  return <SeriesDetailContent series={series} episodes={episodes} />;
}
