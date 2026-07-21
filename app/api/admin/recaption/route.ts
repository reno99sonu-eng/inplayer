import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import mux from "@/app/lib/mux";
import { docClient } from "@/app/lib/dynamodb";

// One-off maintenance endpoint: brings every ALREADY-PUBLISHED video and
// Short in line with the caption pipeline fixed in app/api/webhooks/mux
// (see that file's comments for the full root-cause writeup — in short,
// Mux has no ASR model for Hindi/Bengali, its "auto" detection regularly
// mistagged Hindi as Urdu, and Shorts were never supposed to get captions
// at all). That fix only changes behavior for NEW uploads; this endpoint
// is what reaches back and applies it to everything already on the site.
//
// Not a product feature — meant to be triggered once (by hand, with curl)
// by whoever holds ADMIN_MAINTENANCE_KEY. Safe to re-run: every step is a
// no-op, or harmlessly repeats, on anything that already went through it.
export const maxDuration = 300;

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function scanAllVideos(): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "InPlayer-Videos",
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    items.push(...((result.Items || []) as Record<string, unknown>[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

// Deletes every text (subtitle) track currently on the asset — both any
// leftover raw "Auto-generated" track and any previously-created
// translated tracks — so whatever runs next starts from a clean slate
// instead of piling up duplicate/conflicting menu entries.
async function deleteAllTextTracks(assetId: string): Promise<string[]> {
  const errors: string[] = [];

  try {
    const asset = await mux.video.assets.retrieve(assetId);
    const textTracks = (asset.tracks || []).filter((t) => t.type === "text");

    for (const t of textTracks) {
      if (!t.id) continue;
      try {
        await mux.video.assets.deleteTrack(assetId, t.id);
      } catch (err) {
        errors.push(`delete track ${t.id}: ${errMsg(err)}`);
      }
    }
  } catch (err) {
    errors.push(`retrieve asset: ${errMsg(err)}`);
  }

  return errors;
}

async function clearCaptionState(videoId: string): Promise<string | null> {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId },
        UpdateExpression: "REMOVE captionsVtt, captionsTranslated",
      })
    );
    return null;
  } catch (err) {
    return `clear DB caption fields: ${errMsg(err)}`;
  }
}

export async function POST(request: NextRequest) {
  const expectedKey = process.env.ADMIN_MAINTENANCE_KEY;
  const providedKey = request.headers.get("x-admin-key");

  if (!expectedKey || providedKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allItems = await scanAllVideos();

  const shorts = { processed: 0, errors: [] as string[] };
  const videos = { processed: 0, requeued: 0, errors: [] as string[] };

  for (const item of allItems) {
    const videoId = item.videoId as string;
    const assetId = item.muxAssetId as string | undefined;
    if (!videoId || !assetId) continue;

    if (item.contentType === "short") {
      // Shorts should never have captions — strip whatever they ended up
      // with (including any stray mislabeled-language track) and clear the
      // stored translation state so nothing stale lingers.
      shorts.processed++;
      const trackErrors = await deleteAllTextTracks(assetId);
      trackErrors.forEach((e) => shorts.errors.push(`${videoId}: ${e}`));

      if (item.captionsVtt || item.captionsTranslated) {
        const clearErr = await clearCaptionState(videoId);
        if (clearErr) shorts.errors.push(`${videoId}: ${clearErr}`);
      }
      continue;
    }

    // Everything else is a Video (including older records saved before
    // contentType existed, which default to "video" everywhere else in
    // this codebase too).
    videos.processed++;

    const trackErrors = await deleteAllTextTracks(assetId);
    trackErrors.forEach((e) => videos.errors.push(`${videoId}: ${e}`));

    const clearErr = await clearCaptionState(videoId);
    if (clearErr) {
      videos.errors.push(`${videoId}: ${clearErr}`);
      continue; // don't requeue on top of a DB state we couldn't reset
    }

    try {
      const asset = await mux.video.assets.retrieve(assetId);
      const audioTrack = (asset.tracks || []).find((t) => t.type === "audio");

      if (audioTrack?.id) {
        // Same hinting rule as app/api/webhooks/mux: English gets an
        // explicit hint (Mux supports it), Hindi/Bengali/unset fall back to
        // "auto" because Mux has no explicit hint option for them at all —
        // the normalization + Gemini cleanup pass in the webhook is what
        // makes that safe now.
        const hintLang: "en" | "auto" =
          item.spokenLanguage === "en" ? "en" : "auto";

        await mux.video.assets.generateSubtitles(assetId, audioTrack.id, {
          generated_subtitles: [
            { language_code: hintLang, name: "Auto-generated" },
          ],
        });
        videos.requeued++;
      }
    } catch (err) {
      videos.errors.push(`${videoId}: requeue captions: ${errMsg(err)}`);
    }
  }

  return NextResponse.json({ shorts, videos });
}
