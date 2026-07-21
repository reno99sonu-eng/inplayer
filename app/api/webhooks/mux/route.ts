import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import mux from "@/app/lib/mux";
import { docClient } from "@/app/lib/dynamodb";
import { READY_VIDEOS_TAG } from "@/app/lib/videoStore";
import { translateVtt, cleanupVtt } from "@/app/lib/translate";

// Caption translation (below) runs after the webhook response via after(),
// but still needs the function alive long enough to finish 2–3 Gemini
// calls — the default timeout is too tight for that.
export const maxDuration = 60;

// The caption languages every video should end up with. Whichever of these
// matches the video's actual spoken language gets its own cleaned-up track
// instead of a translated one; Mux's raw auto-generated track (labeled
// whatever language Mux's "auto" detection guessed) is deleted once this
// set is live — see video.asset.track.ready below.
const CAPTION_TARGETS: Array<{ code: string; name: string; label: string }> = [
  { code: "en", name: "English", label: "English" },
  { code: "hi", name: "Hindi", label: "हिन्दी" },
  { code: "bn", name: "Bengali", label: "বাংলা" },
];

// Collapses a Mux-detected BCP-47 code down to its base language, folding
// in known ASR mix-ups. Mux's speech-to-text has no Hindi model, so "auto"
// detection on Hindi audio very often comes back tagged "ur" (Urdu) — the
// closest-sounding language Mux's detector actually knows — even though
// this app has never offered, and doesn't want, Urdu captions. Collapse
// that back to Hindi so it never surfaces as a caption-menu entry.
function normalizeLangCode(code: unknown): string {
  const base = String(code || "").split("-")[0].toLowerCase();
  if (base === "ur") return "hi";
  return base;
}

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

    const playbackId = asset.playback_ids?.[0]?.id;

    const updateResult = await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId: uploadId },
        UpdateExpression:
          "SET #status = :status, muxAssetId = :assetId, muxPlaybackId = :playbackId, #duration = :duration, thumbnailUrl = :thumbnailUrl",
        ExpressionAttributeNames: {
          "#status": "status",
          "#duration": "duration",
        },
        ExpressionAttributeValues: {
          ":status": "ready",
          ":assetId": asset.id,
          ":playbackId": playbackId || "",
          ":duration": asset.duration || 0,
          ":thumbnailUrl": playbackId
            ? `https://image.mux.com/${playbackId}/thumbnail.jpg`
            : "",
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
  // Gemini into each remaining target language (English/Hindi/Bengali),
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

      if (match && !match.captionsTranslated && match.muxPlaybackId) {
        const origin = request.nextUrl.origin;
        const trackId = track.id;

        // A creator's own declared spoken language (set at upload, see
        // app/upload/page.tsx) is always trusted over Mux's "auto" guess
        // when we have it — Mux has no ASR model for Hindi/Bengali at all,
        // so its guess for those is regularly wrong (see
        // normalizeLangCode). Mux's detected code is only a fallback for
        // videos uploaded before that field existed.
        const detectedLang = normalizeLangCode(track.language_code);
        const sourceLang =
          match.spokenLanguage && match.spokenLanguage !== "auto"
            ? match.spokenLanguage
            : detectedLang;
        const sourceTarget = CAPTION_TARGETS.find((t) => t.code === sourceLang);

        // Translation takes multiple model calls — run it AFTER responding
        // 200 to Mux (webhooks must answer fast or Mux marks them failed).
        after(async () => {
          try {
            const vttRes = await fetch(
              `https://stream.mux.com/${match.muxPlaybackId}/text/${trackId}.vtt`
            );
            if (!vttRes.ok) {
              console.error(`Couldn't fetch generated VTT (${vttRes.status})`);
              return;
            }
            const rawSourceVtt = await vttRes.text();
            if (!rawSourceVtt.startsWith("WEBVTT")) return;

            // Mux's "auto" transcription for Hindi/Bengali is prone to
            // script slips and mixed-language cues (no dedicated ASR model
            // — see cleanupVtt). Proofread it back into clean, consistent
            // text before it becomes either the source-language track
            // itself or the basis every other translation is built from.
            // English transcription is native/reliable, so it skips this.
            let sourceVtt = rawSourceVtt;
            if (sourceTarget && (sourceLang === "hi" || sourceLang === "bn")) {
              const cleaned = await cleanupVtt(rawSourceVtt, sourceTarget.name);
              if (cleaned) sourceVtt = cleaned;
            }

            const targets = CAPTION_TARGETS.filter(
              (t) => t.code !== sourceLang
            );
            const captionsVtt: Record<string, string> = {};

            // The spoken language gets its own (now-cleaned) track too,
            // instead of leaving Mux's raw "Auto-generated" entry as its
            // only representation on the asset — that raw entry is what
            // was surfacing mislabeled (e.g. as Urdu). It's deleted below
            // once this full replacement set is live.
            if (sourceTarget) captionsVtt[sourceTarget.code] = sourceVtt;

            for (const target of targets) {
              const translated = await translateVtt(sourceVtt, target.name);
              if (translated) captionsVtt[target.code] = translated;
            }

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
                Key: { videoId: match.videoId },
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
                  url: `${origin}/api/videos/${match.videoId}/captions/${target.code}`,
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
            // if this fails: worse case is the old entry lingers alongside
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
              `Captions ready for ${match.videoId}: ${languages.join(", ")}`
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