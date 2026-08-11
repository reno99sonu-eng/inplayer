import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { GetCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import mux from "@/app/lib/mux";
import { docClient } from "@/app/lib/dynamodb";
import { getMuxThumbnailUrl } from "@/app/lib/muxThumbnail";
import { READY_VIDEOS_TAG } from "@/app/lib/videoStore";
import { MIDROLL_ADS_TAG } from "@/app/lib/videoAds";
import {
  CAPTION_TARGETS,
  resolveSourceLang,
  buildCaptionSet,
} from "@/app/lib/captions";

// Caption translation (below) runs after the webhook response via after(),
// but still needs the function alive long enough to finish the Groq
// calls. buildCaptionSet now runs those translations concurrently so it
// comfortably fits, but we give generous headroom anyway — a caption run
// that gets killed mid-way leaves a video stuck on its raw auto track
// (which is exactly the bug this whole change is fixing), so the extra
// ceiling is cheap insurance. (Plans that cap function duration lower will
// simply cap this; the backfill endpoint is the safety net either way.)
export const maxDuration = 300;

// Best-to-worst download quality order. Used to pick a sensible default
// (`downloadFileName`) from whichever renditions have finished so far.
const QUALITY_PREFERENCE = [
  "highest",
  "2160p",
  "1440p",
  "1080p",
  "720p",
  "540p",
  "480p",
  "360p",
  "270p",
];

function pickBestName(renditions: Record<string, string>): string {
  for (const q of QUALITY_PREFERENCE) {
    if (renditions[q]) return renditions[q];
  }
  const values = Object.values(renditions);
  return values[0] || "";
}

// Static-rendition webhook events identify the asset only via the Mux
// Asset ID (event.object.id) — never our own videoId — so unlike the
// other handlers below (which get to key straight off upload_id), this
// one has to look our record up. There's no GSI on muxAssetId yet, so
// this follows the same Scan-based lookup pattern already used elsewhere
// in this codebase (app/api/my-videos, app/shorts, etc.) rather than
// introducing a new indexing strategy just for this.
//
// DynamoDB caps a single Scan response at ~1MB, and silently returns only
// that page — it does NOT automatically follow the rest of the table.
// A one-shot Scan (no LastEvaluatedKey loop) can therefore miss a
// genuinely-matching item once the table outgrows that page, with no
// error raised — it just looks like "no video found". Looping here
// guarantees the whole table gets checked no matter how large it gets.
async function findVideoByAssetId(assetId: string) {
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        FilterExpression: "muxAssetId = :assetId",
        ExpressionAttributeValues: { ":assetId": assetId },
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    if (result.Items?.[0]) return result.Items[0];
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return undefined;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // unwrap() both verifies the signature AND parses the event in one
  // step, using the webhookSecret already configured on the mux client.
  // It throws if the signature is missing/invalid.
  let event;

  try {
    event = await mux.webhooks.unwrap(rawBody, request.headers);
  } catch (err) {
    console.error("Mux webhook verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type === "video.asset.ready") {
    const asset = event.data;
    const uploadId = asset.upload_id;

    if (!uploadId) {
      console.error("video.asset.ready had no upload_id — asset:", asset.id);
      return NextResponse.json({ received: true });
    }

    // Direct uploads always request public playback, and (for videos, not
    // Shorts — see app/api/upload/create) ALSO request a second, signed
    // playback ID on the same asset. image.mux.com requires a playback ID
    // (never the asset or direct-upload ID) and signed playback would need
    // a signed image token we intentionally do not expose here, so
    // thumbnails always use the public one.
    const playbackId = asset.playback_ids?.find(
      (id: { id?: string; policy?: string }) => id.policy === "public"
    )?.id;
    // Real enforcement for the "Members only" toggle (see
    // app/api/videos/[videoId]/playback-token) — a signed playback ID is
    // useless to anyone without a per-request token InPlayer's own server
    // issues, unlike the public one above which anyone with the URL can
    // play regardless of app-level checks. Absent on Shorts (never
    // requested) — that's expected, not an error.
    const signedPlaybackId = asset.playback_ids?.find(
      (id: { id?: string; policy?: string }) => id.policy === "signed"
    )?.id;

    if (!playbackId) {
      console.error(
        "video.asset.ready had no public playback ID - asset:",
        asset.id
      );
      // Do not make an unplayable/unthumbnailable asset visible. A non-2xx
      // response lets Mux retry while the asset's playback configuration is
      // being finalized.
      return NextResponse.json(
        { error: "Mux asset has no public playback ID" },
        { status: 500 }
      );
    }

    // Portrait Shorts need a portrait-shaped auto thumbnail, not the
    // landscape crop regular videos get — see the comment on
    // getMuxThumbnailUrl in app/lib/muxThumbnail.ts for why. contentType
    // isn't part of the Mux webhook payload at all (Mux has no idea what a
    // "Short" is), so it's read back from the placeholder row this same
    // upload already wrote at creation time (app/api/upload/create).
    const existing = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId: uploadId },
        ProjectionExpression: "contentType",
      })
    );

    if (!existing.Item) {
      // It might be a mid-roll video ad
      const midrollAd = await docClient.send(
        new GetCommand({
          TableName: "InPlayer-Midroll-Ads",
          Key: { adId: uploadId },
        })
      );
      if (midrollAd.Item) {
        await docClient.send(
          new UpdateCommand({
            TableName: "InPlayer-Midroll-Ads",
            Key: { adId: uploadId },
            UpdateExpression: "SET #status = :status, imageUrl = :imageUrl",
            ExpressionAttributeNames: {
              "#status": "status",
            },
            ExpressionAttributeValues: {
              ":status": "ready",
              // Store as a Mux prefix to differentiate from base64
              ":imageUrl": `mux:${playbackId}`,
            },
          })
        );
        // Without this, a freshly-ready ad still couldn't be served for up
        // to 30s (getAllMidrollAds's cache TTL, app/lib/videoAds.ts) —
        // same immediate-invalidation pattern already used for
        // READY_VIDEOS_TAG just above in this same file.
        revalidateTag(MIDROLL_ADS_TAG, "max");
        // Mid-roll ads don't use captions or email broadcasts
        return NextResponse.json({ received: true });
      } else {
        console.error("No video or ad found for uploadId:", uploadId);
        return NextResponse.json({ received: true });
      }
    }

    const isShort = existing.Item.contentType === "short";
    const thumbnailUrl = getMuxThumbnailUrl(playbackId, isShort);

    const updateResult = await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId: uploadId },
        // thumbnailUrl uses if_not_exists() against customThumbnailUrl (set
        // at upload time when the creator picked their own thumbnail) so a
        // creator-supplied thumbnail always wins and is never overwritten
        // by Mux's auto-generated one once processing finishes. Videos
        // without a custom thumbnail simply have no customThumbnailUrl
        // attribute, so if_not_exists() falls through to Mux's own image.
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
        // Read contentType/spokenLanguage back (set at upload time, untouched
        // by this update) so the caption step below can decide whether — and
        // how — to run, without a second round-trip to DynamoDB.
        ReturnValues: "ALL_NEW",
      })
    );

    // The listing pages read a 30-second cached video list (see
    // lib/videoStore) — bust it now so this freshly-ready video shows up
    // on the homepage immediately instead of waiting out the cache.
    // ("max" is the profile Next 16 requires as the second argument —
    // it's what Next's own upgrade codemod inserts for plain tag busts.)
    revalidateTag(READY_VIDEOS_TAG, "max");

    // Automatically broadcast email notifications to all channel subscribers
    const videoAttributes = updateResult.Attributes;
    if (videoAttributes && videoAttributes.uploaderId) {
      const { broadcastNewVideoToSubscribers } = await import("@/app/lib/subscriptionBroadcast");
      void broadcastNewVideoToSubscribers({
        videoId: uploadId,
        title: videoAttributes.title || "New Video",
        description: videoAttributes.description || "",
        thumbnailUrl: videoAttributes.thumbnailUrl || thumbnailUrl,
        uploaderId: videoAttributes.uploaderId,
        uploaderName: videoAttributes.uploaderName || "Creator",
        uploaderAvatarUrl: videoAttributes.uploaderAvatarUrl,
        contentType: videoAttributes.contentType === "short" ? "short" : "video",
      }).catch((err) => console.error("Failed to broadcast new video email to subscribers:", err));
    }

    // Kick off automatic caption generation on the asset's primary audio
    // track — Shorts are explicitly excluded, they should never get
    // captions. Mux runs speech recognition against the track and, once
    // done, adds a subtitle text track to the asset; the
    // video.asset.track.ready handler below turns that single track into
    // the full translated set (and replaces it with properly-labeled
    // English/Hindi/Bengali tracks). Silent videos (no audio track) simply
    // have nothing to caption — that's an expected case, not an error.
    const contentType = updateResult.Attributes?.contentType;
    const spokenLanguage = updateResult.Attributes?.spokenLanguage;

    const audioTrack = asset.tracks?.find(
      (track: { type?: string; id?: string }) => track.type === "audio"
    );

    if (audioTrack?.id && contentType !== "short") {
      try {
        // Mux's ASR only accepts an explicit language hint for a fixed set
        // of (mostly European) languages — Hindi and Bengali aren't in that
        // set, so "auto" is the only option available for them, and stays
        // the default here. English IS in the set, so when the uploader has
        // told us the video is English, hint it explicitly instead of
        // making Mux guess.
        const hintLang: "en" | "auto" = spokenLanguage === "en" ? "en" : "auto";

        await mux.video.assets.generateSubtitles(asset.id, audioTrack.id, {
          generated_subtitles: [
            { language_code: hintLang, name: "Auto-generated" },
          ],
        });
      } catch (err) {
        // Never let a captions failure affect the asset itself finishing
        // up as "ready" above — the video is already fully playable
        // without captions, and generating them is best-effort.
        console.error("Caption generation request failed:", err);
      }
    }
  }

  // Fires once Mux's auto-generated captions finish. That single track is
  // in the video's SPOKEN language only — this pipeline turns it into the
  // full multi-language set: fetch the generated VTT, translate it via
  // Groq into each remaining target language (English/Hindi/Bengali),
  // store the translations, and register them with Mux as real subtitle
  // tracks. Once registered they live in the playback manifest itself, so
  // every device's player shows the language menu natively.
  if (event.type === "video.asset.track.ready") {
    const track = event.data;
    // IMPORTANT: event.object.id is the TRACK's id for track events (the
    // logs proved it — object.id printed identical to track.id). The
    // parent asset lives in data.asset_id.
    const assetId = track.asset_id || event.object.id;

    if (track.text_source === "generated_vod" && track.id) {
      const match = await findVideoByAssetId(assetId);

      if (match && match.contentType !== "short" && !match.captionsTranslated && match.muxPlaybackId) {
        const origin = request.nextUrl.origin;
        const trackId = track.id;
        const playbackId = match.muxPlaybackId;
        const videoId = match.videoId;

        // Trust the creator's declared spoken language over Mux's "auto"
        // guess (Mux has no Hindi/Bengali ASR model, so its guess for those
        // is unreliable); fall back to Mux's detected code for videos
        // uploaded before the upload-time field existed.
        const sourceLang = resolveSourceLang(
          match.spokenLanguage,
          track.language_code
        );

        // Translation takes multiple model calls — run it AFTER responding
        // 200 to Mux (webhooks must answer fast or Mux marks them failed).
        after(async () => {
          try {
            const vttRes = await fetch(
              `https://stream.mux.com/${playbackId}/text/${trackId}.vtt`
            );
            if (!vttRes.ok) {
              console.error(`Couldn't fetch generated VTT (${vttRes.status})`);
              return;
            }
            const rawSourceVtt = await vttRes.text();
            if (!rawSourceVtt.startsWith("WEBVTT")) return;

            const captionsVtt = await buildCaptionSet(rawSourceVtt, sourceLang);

            const languages = Object.keys(captionsVtt);
            if (languages.length === 0) {
              console.error("Caption translation produced no output");
              return;
            }

            // Keep well under DynamoDB's 400KB item limit.
            const totalSize = languages.reduce(
              (sum, lang) => sum + captionsVtt[lang].length,
              0
            );
            if (totalSize > 300_000) {
              console.error("Translated captions too large to store, skipping");
              return;
            }

            // Store FIRST so the captions route can serve the files, then
            // point Mux at them.
            await docClient.send(
              new UpdateCommand({
                TableName: "InPlayer-Videos",
                Key: { videoId },
                UpdateExpression:
                  "SET captionsVtt = :vtt, captionsTranslated = :done",
                ExpressionAttributeValues: {
                  ":vtt": captionsVtt,
                  ":done": true,
                },
              })
            );

            for (const target of CAPTION_TARGETS) {
              if (!captionsVtt[target.code]) continue;
              try {
                await mux.video.assets.createTrack(assetId, {
                  url: `${origin}/api/videos/${videoId}/captions/${target.code}`,
                  type: "text",
                  text_type: "subtitles",
                  language_code: target.code,
                  name: target.label,
                  passthrough: "auto-translated",
                });
              } catch (err) {
                console.error(
                  `Failed to add ${target.code} track to asset ${assetId}:`,
                  err
                );
              }
            }

            // Mux's raw auto-generated track is now fully superseded by the
            // properly-labeled set just created above — remove it so
            // viewers never see the ambiguous "Auto-generated" entry (or a
            // misdetected language like Urdu) in the caption menu. Non-fatal
            // if this fails: worst case is the old entry lingers alongside
            // the clean ones, not that captions go missing.
            try {
              await mux.video.assets.deleteTrack(assetId, trackId);
            } catch (err) {
              console.error(
                `Failed to delete raw auto-generated track ${trackId} on asset ${assetId}:`,
                err
              );
            }

            console.log(
              `Captions ready for ${videoId}: ${languages.join(", ")}`
            );
          } catch (err) {
            console.error("Caption translation pipeline failed:", err);
          }
        });
      }
    }
  }

  if (event.type === "video.asset.track.errored") {
    console.error(
      `Track generation failed — asset ${event.data.asset_id || event.object.id}:`,
      event.data
    );
  }

  // Fires once one of the downloadable static MP4 renditions we requested
  // (1080p / 720p / 480p, at upload time or via the on-demand backfill in
  // app/api/videos/[videoId]/prepare-download) finishes encoding. Each
  // quality fires its own event, so we accumulate them into a per-quality
  // map (resolution -> filename) and keep downloadFileName pointing at the
  // best available as the default.
  if (event.type === "video.asset.static_rendition.ready") {
    const rendition = event.data;
    // Same object.id trap as track events: for static_rendition events,
    // event.object.id is the RENDITION's id — the parent asset id lives
    // in data.asset_id. Using object.id here was why webhook lookups kept
    // logging "no video found for asset ..." while downloads only
    // recovered through prepare-download's self-heal path.
    const assetId = rendition.asset_id || event.object.id;

    if (rendition.status === "ready" && rendition.name) {
      const match = await findVideoByAssetId(assetId);

      if (match) {
        const resolution = String(
          rendition.resolution || rendition.name
        ).replace(/\.(mp4|m4a)$/, "");
        const mergedRenditions: Record<string, string> = {
          ...((match.downloadRenditions || {}) as Record<string, string>),
          [resolution]: rendition.name,
        };

        await docClient.send(
          new UpdateCommand({
            TableName: "InPlayer-Videos",
            Key: { videoId: match.videoId },
            UpdateExpression:
              "SET downloadStatus = :status, downloadRenditions = :renditions, downloadFileName = :best",
            ExpressionAttributeValues: {
              ":status": "ready",
              ":renditions": mergedRenditions,
              ":best": pickBestName(mergedRenditions),
            },
          })
        );
      } else {
        // Returning 200 here would tell Mux this event was delivered
        // successfully — Mux never sends it again after that, which
        // would leave the matching video's download permanently stuck in
        // "preparing" with no way to recover (this is exactly what
        // happened before this fix). Returning a non-2xx instead makes
        // Mux retry this same delivery on its own backoff schedule, so a
        // transient lookup issue gets a real chance to resolve instead of
        // silently stranding the video.
        console.error("static_rendition.ready: no video found for asset", assetId);
        return NextResponse.json(
          { error: "No matching video found, will retry" },
          { status: 500 }
        );
      }
    }
  }

  // A rendition failed to generate. With three qualities requested, one
  // erroring (or being skipped because it's higher than the source) must
  // NOT knock the whole download offline if another quality already
  // succeeded — only mark the download errored when nothing is ready yet,
  // so a viewer's next Download click (via prepare-download) retries.
  if (event.type === "video.asset.static_rendition.errored") {
    const assetId = event.data.asset_id || event.object.id;
    const match = await findVideoByAssetId(assetId);

    if (match) {
      const hasReady =
        Object.keys(match.downloadRenditions || {}).length > 0;

      if (!hasReady) {
        await docClient.send(
          new UpdateCommand({
            TableName: "InPlayer-Videos",
            Key: { videoId: match.videoId },
            UpdateExpression: "SET downloadStatus = :status",
            ExpressionAttributeValues: { ":status": "errored" },
          })
        );
      }
    }
  }

  if (event.type === "video.asset.errored") {
    const asset = event.data;
    const uploadId = asset.upload_id;

    if (uploadId) {
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId: uploadId },
          UpdateExpression: "SET #status = :status",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":status": "error" },
        })
      );
    }
  }

  // Always respond 200 once we've processed the event, so Mux doesn't
  // keep retrying an event we've already handled.
  return NextResponse.json({ received: true });
}
