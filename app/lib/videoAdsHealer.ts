import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { revalidateTag } from "next/cache";
import { docClient } from "@/app/lib/dynamodb";
import mux from "@/app/lib/mux";
import { MIDROLL_ADS_TABLE, MIDROLL_ADS_TAG } from "@/app/lib/videoAds";

/**
 * Actively checks Mux for an in-progress mid-roll video ad upload.
 * If Mux has completed transcoding (asset is "ready"), updates DynamoDB
 * with status "ready" and imageUrl "mux:${playbackId}", revalidates cache,
 * and returns the updated ad item.
 */
export async function selfHealMidrollAd(
  item: Record<string, any>
): Promise<Record<string, any>> {
  if (!item || item.status !== "processing" || !item.adId) {
    return item;
  }

  try {
    const upload = await mux.video.uploads.retrieve(item.adId);
    if (upload.asset_id) {
      const asset = await mux.video.assets.retrieve(upload.asset_id);
      if (asset.status === "ready") {
        const playbackId = asset.playback_ids?.find(
          (id: { id?: string; policy?: string }) => id.policy === "public"
        )?.id;

        if (playbackId) {
          const updateResult = await docClient.send(
            new UpdateCommand({
              TableName: MIDROLL_ADS_TABLE,
              Key: { adId: item.adId },
              UpdateExpression:
                "SET #status = :status, imageUrl = :imageUrl, muxAssetId = :assetId",
              ExpressionAttributeNames: {
                "#status": "status",
              },
              ExpressionAttributeValues: {
                ":status": "ready",
                ":imageUrl": `mux:${playbackId}`,
                ":assetId": asset.id,
              },
              ReturnValues: "ALL_NEW",
            })
          );

          revalidateTag(MIDROLL_ADS_TAG, "max");

          if (updateResult.Attributes) {
            return updateResult.Attributes;
          }
        }
      } else if (asset.status === "errored") {
        const updateResult = await docClient.send(
          new UpdateCommand({
            TableName: MIDROLL_ADS_TABLE,
            Key: { adId: item.adId },
            UpdateExpression: "SET #status = :status",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":status": "error" },
            ReturnValues: "ALL_NEW",
          })
        );

        revalidateTag(MIDROLL_ADS_TAG, "max");

        if (updateResult.Attributes) {
          return updateResult.Attributes;
        }
      }
    }
  } catch (err) {
    console.error("Self-heal check failed for midroll ad", item.adId, err);
  }

  return item;
}

export async function selfHealMidrollAdsBatch(
  items: Record<string, any>[]
): Promise<Record<string, any>[]> {
  const processingItems = items.filter((i) => i && i.status === "processing");
  if (processingItems.length === 0) return items;

  const healed = await Promise.all(
    items.map(async (item) => {
      if (item && item.status === "processing") {
        return await selfHealMidrollAd(item);
      }
      return item;
    })
  );

  return healed;
}
