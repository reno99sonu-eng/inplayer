import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import mux from "@/app/lib/mux";
import { getMuxThumbnailUrl } from "@/app/lib/muxThumbnail";

export async function selfHealVideoItem(item: Record<string, any>): Promise<Record<string, any>> {
  if (!item || item.status !== "processing" || !item.videoId) {
    return item;
  }

  try {
    const upload = await mux.video.uploads.retrieve(item.videoId);
    if (upload.asset_id) {
      const asset = await mux.video.assets.retrieve(upload.asset_id);
      if (asset.status === "ready") {
        const playbackId = asset.playback_ids?.find((id) => id.policy === "public")?.id;
        const signedPlaybackId = asset.playback_ids?.find((id) => id.policy === "signed")?.id;

        if (playbackId) {
          const isShort = item.contentType === "short";
          const thumbnailUrl = getMuxThumbnailUrl(playbackId, isShort);

          const updateResult = await docClient.send(
            new UpdateCommand({
              TableName: "InPlayer-Videos",
              Key: { videoId: item.videoId },
              UpdateExpression:
                "SET #status = :status, muxAssetId = :assetId, muxPlaybackId = :playbackId, #duration = :duration, thumbnailUrl = if_not_exists(customThumbnailUrl, :thumbnailUrl)" +
                (signedPlaybackId ? ", muxSignedPlaybackId = :signedPlaybackId" : ""),
              ExpressionAttributeNames: {
                "#status": "status",
                "#duration": "duration",
              },
              ExpressionAttributeValues: {
                ":status": "ready",
                ":assetId": asset.id,
                ":playbackId": playbackId,
                ":duration": asset.duration || 0,
                ":thumbnailUrl": thumbnailUrl,
                ...(signedPlaybackId && { ":signedPlaybackId": signedPlaybackId }),
              },
              ReturnValues: "ALL_NEW",
            })
          );
          if (updateResult.Attributes) {
            return updateResult.Attributes;
          }
        }
      } else if (asset.status === "errored") {
        const updateResult = await docClient.send(
          new UpdateCommand({
            TableName: "InPlayer-Videos",
            Key: { videoId: item.videoId },
            UpdateExpression: "SET #status = :status",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":status": "error" },
            ReturnValues: "ALL_NEW",
          })
        );
        if (updateResult.Attributes) {
          return updateResult.Attributes;
        }
      }
    }
  } catch (err) {
    console.error("Self-heal check failed for video", item.videoId, err);
  }

  return item;
}

export async function selfHealVideoBatch(items: Record<string, any>[]): Promise<Record<string, any>[]> {
  const processingItems = items.filter((i) => i && i.status === "processing");
  if (processingItems.length === 0) return items;

  const healed = await Promise.all(
    items.map(async (item) => {
      if (item && item.status === "processing") {
        return await selfHealVideoItem(item);
      }
      return item;
    })
  );

  return healed;
}
