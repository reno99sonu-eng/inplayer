import { NextRequest, NextResponse } from "next/server";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import mux from "@/app/lib/mux";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import {
  CAPTION_TARGETS,
  resolveSourceLang,
  buildCaptionSet,
} from "@/app/lib/captions";

// Who may trigger this maintenance job. Two independent ways in, so it
// works no matter how it's called:
//   1. A signed-in user whose account email is in ADMIN_EMAILS — this is
//      what the in-app "Repair captions" button uses (app/admin/captions),
//      and needs no server configuration at all.
//   2. A matching x-admin-key header (ADMIN_MAINTENANCE_KEY env var) — for
//      curl / automation when there's no browser session.
const ADMIN_EMAILS = ["reno99sonu@gmail.com"];

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const expectedKey = process.env.ADMIN_MAINTENANCE_KEY;
  const providedKey = request.headers.get("x-admin-key");
  if (expectedKey && providedKey === expectedKey) return true;

  try {
    const user = await verifyAuth(request);
    const email = user.email?.toLowerCase();
    if (email && ADMIN_EMAILS.includes(email)) return true;
  } catch {
    // Not a valid signed-in request — fall through to unauthorized.
  }
  return false;
}

// One-time maintenance endpoint: brings every ALREADY-PUBLISHED video and
// Short in line with the fixed caption pipeline (see app/lib/captions and
// app/api/webhooks/mux). The webhook only changes NEW uploads; this is what
// reaches back and repairs everything already on the site.
//
// Triggered by hand (whoever holds ADMIN_MAINTENANCE_KEY). Designed to be
// run repeatedly with no harm:
//   - Each item is marked `captionsBackfilled` once handled and skipped on
//     later runs, so re-running simply resumes where a previous run stopped.
//   - It self-limits to a time budget well under the function ceiling and
//     reports how many items remain, so a large library is drained across a
//     few calls instead of one call that dies half-done.
export const maxDuration = 300;

// Stop STARTING new (slow, Groq-backed) video items once this much wall
// time has passed, so each call always returns real JSON (with a partial
// result + `remainingVideos`) well before the 300s function ceiling instead
// of being killed. This works hand-in-hand with the per-Groq-call timeout
// in app/lib/translate: that caps any single video at ~2 min, and this
// budget guarantees a new one never STARTS late enough to run past the
// ceiling. The in-app button just keeps calling until `done`. Shorts are
// near-instant (no Groq) and always all finish in the first call.
const TIME_BUDGET_MS = 90_000;

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

// Deletes every text (subtitle) track on the asset — the raw auto-generated
// one plus any previously-created translated tracks — so the asset starts
// clean. Returns the list of text tracks that existed (so callers can find
// the source transcript first if they need it). Best-effort per track.
async function retrieveTextTracks(assetId: string) {
  const asset = await mux.video.assets.retrieve(assetId);
  return (asset.tracks || []).filter((t) => t.type === "text");
}

async function deleteTracks(
  assetId: string,
  trackIds: string[]
): Promise<string[]> {
  const errors: string[] = [];
  for (const id of trackIds) {
    try {
      await mux.video.assets.deleteTrack(assetId, id);
    } catch (err) {
      errors.push(`delete track ${id}: ${errMsg(err)}`);
    }
  }
  return errors;
}

async function markBackfilled(videoId: string, clearCaptions: boolean) {
  await docClient.send(
    new UpdateCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
      UpdateExpression: clearCaptions
        ? "SET captionsBackfilled = :t REMOVE captionsVtt, captionsTranslated"
        : "SET captionsBackfilled = :t",
      ExpressionAttributeValues: { ":t": true },
    })
  );
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const allItems = await scanAllVideos();

  const shorts = { processed: 0, skipped: 0, errors: [] as string[] };
  const videos = {
    processed: 0,
    skipped: 0,
    partial: 0,
    errors: [] as string[],
  };
  let remainingVideos = 0;

  // Shorts first: they're fast (no Groq), so a run always fully clears
  // them even if the slower video work later runs out of time budget.
  for (const item of allItems) {
    if (item.contentType !== "short") continue;

    const videoId = item.videoId as string;
    const assetId = item.muxAssetId as string | undefined;
    if (!videoId || !assetId) continue;

    if (item.captionsBackfilled === true) {
      shorts.skipped++;
      continue;
    }

    try {
      const textTracks = await retrieveTextTracks(assetId);
      const ids = textTracks.map((t) => t.id).filter(Boolean) as string[];
      const delErrors = await deleteTracks(assetId, ids);
      delErrors.forEach((e) => shorts.errors.push(`${videoId}: ${e}`));
      // Shorts must never carry captions — clear any stored translation
      // state too, and mark handled.
      await markBackfilled(videoId, true);
      shorts.processed++;
    } catch (err) {
      shorts.errors.push(`${videoId}: ${errMsg(err)}`);
    }
  }

  // Videos: rebuild the clean multi-language set from each video's EXISTING
  // transcript — no re-transcription (Mux would just reproduce the same
  // bad Hindi/Bengali output; the fix lives entirely in the Groq layer).
  const origin = request.nextUrl.origin;

  for (const item of allItems) {
    if (item.contentType === "short") continue;

    const videoId = item.videoId as string;
    const assetId = item.muxAssetId as string | undefined;
    const playbackId = item.muxPlaybackId as string | undefined;
    if (!videoId || !assetId) continue;

    if (item.captionsBackfilled === true) {
      videos.skipped++;
      continue;
    }

    // Out of time budget — leave the rest for the next invocation.
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      remainingVideos++;
      continue;
    }

    try {
      const textTracks = await retrieveTextTracks(assetId);
      const source =
        textTracks.find((t) => t.text_source === "generated_vod") ||
        textTracks[0];

      // No transcript to work from (silent video, or captions never
      // generated). Kick off a fresh transcription — the fixed webhook will
      // finish it when the track becomes ready — and mark handled so we
      // don't re-trigger it every run.
      if (!source?.id || !playbackId) {
        const audioTrackId = (await mux.video.assets.retrieve(assetId)).tracks?.find(
          (t) => t.type === "audio"
        )?.id;
        if (audioTrackId) {
          await mux.video.assets.generateSubtitles(assetId, audioTrackId, {
            generated_subtitles: [
              { language_code: item.spokenLanguage === "en" ? "en" : "auto", name: "Auto-generated" },
            ],
          });
        }
        await markBackfilled(videoId, false);
        videos.processed++;
        continue;
      }

      const vttRes = await fetch(
        `https://stream.mux.com/${playbackId}/text/${source.id}.vtt`
      );
      if (!vttRes.ok) {
        videos.errors.push(`${videoId}: fetch VTT ${vttRes.status}`);
        continue;
      }
      const rawVtt = await vttRes.text();
      if (!rawVtt.startsWith("WEBVTT")) {
        videos.errors.push(`${videoId}: source track not valid VTT`);
        continue;
      }

      const sourceLang = resolveSourceLang(
        item.spokenLanguage,
        source.language_code
      );
      const captionsVtt = await buildCaptionSet(rawVtt, sourceLang);
      const languages = Object.keys(captionsVtt);

      // Nothing came back (Groq fully unavailable). Don't touch the
      // asset's existing tracks — leave it for a later run to retry.
      if (languages.length === 0) {
        videos.errors.push(`${videoId}: translation produced nothing`);
        continue;
      }

      const totalSize = languages.reduce(
        (sum, lang) => sum + captionsVtt[lang].length,
        0
      );
      if (totalSize > 300_000) {
        videos.errors.push(`${videoId}: captions too large`);
        continue;
      }

      // Store the new set first so the captions route can serve it.
      await docClient.send(
        new UpdateCommand({
          TableName: "InPlayer-Videos",
          Key: { videoId },
          UpdateExpression:
            "SET captionsVtt = :vtt, captionsTranslated = :done",
          ExpressionAttributeValues: { ":vtt": captionsVtt, ":done": true },
        })
      );

      // Remove ALL old text tracks (raw auto + any earlier translations),
      // then register the clean, properly-labeled set.
      const oldIds = textTracks.map((t) => t.id).filter(Boolean) as string[];
      const delErrors = await deleteTracks(assetId, oldIds);
      delErrors.forEach((e) => videos.errors.push(`${videoId}: ${e}`));

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
          videos.errors.push(`${videoId}: create ${target.code}: ${errMsg(err)}`);
        }
      }

      await markBackfilled(videoId, false);
      videos.processed++;
      // A full run has all three languages; note anything short of that.
      if (languages.length < CAPTION_TARGETS.length) videos.partial++;
    } catch (err) {
      videos.errors.push(`${videoId}: ${errMsg(err)}`);
    }
  }

  const done = remainingVideos === 0;
  return NextResponse.json({
    done,
    remainingVideos,
    elapsedMs: Date.now() - startedAt,
    shorts,
    videos,
    hint: done
      ? "All items processed. Re-running is safe (already-done items are skipped)."
      : "Time budget reached — call this endpoint again to continue.",
  });
}
