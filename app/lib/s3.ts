import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

// Shared S3 client, same credentials/region convention as app/lib/dynamodb.ts
// and app/lib/mux.ts. The only current use is the live-stream-to-VOD
// pipeline (see app/api/webhooks/ivs-recording/route.ts): IVS auto-records a
// finished livestream into an S3 bucket the account owner sets up by hand,
// and once Mux has fully ingested that recording as a real playable asset
// (see the video.asset.ready fallback in app/api/webhooks/mux/route.ts),
// this cleans the now-redundant S3 copy up.
let client: S3Client | null = null;

export function getS3Client() {
  if (!client) {
    client = new S3Client({
      region: process.env.AWS_REGION || "ap-south-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return client;
}

// Deletes every object under an IVS recording's own key prefix (the HLS
// manifest, every rendition's segments, thumbnails, and the events/*.json
// metadata files IVS writes alongside them) — best-effort, never throws.
// Call this only AFTER Mux has confirmed the asset is fully ready; deleting
// any earlier risks yanking a segment file out from under Mux mid-ingest.
export async function deleteS3Prefix(bucket: string, prefix: string): Promise<void> {
  try {
    const s3 = getS3Client();
    let continuationToken: string | undefined;

    do {
      const listed = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );

      const keys = (listed.Contents || [])
        .map((obj) => obj.Key)
        .filter((key): key is string => Boolean(key));

      if (keys.length > 0) {
        // DeleteObjects tops out at 1000 keys per call — a single livestream
        // recording's rendition/segment count should stay well under that,
        // but chunking defensively costs nothing.
        for (let i = 0; i < keys.length; i += 1000) {
          const batch = keys.slice(i, i + 1000);
          await s3.send(
            new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: { Objects: batch.map((Key) => ({ Key })) },
            })
          );
        }
      }

      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  } catch (err) {
    console.error(`deleteS3Prefix: cleanup failed for s3://${bucket}/${prefix}:`, err);
  }
}
