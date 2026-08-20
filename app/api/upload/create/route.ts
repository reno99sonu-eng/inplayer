import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import mux, { muxErrorMessages } from "@/app/lib/mux";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { THUMBNAIL_DATA_URL_MAX_LENGTH } from "@/app/lib/imageCompress";
import { ensureUsername } from "@/app/lib/ensureUsername";
import { moderateText, UNCHECKED } from "@/app/lib/moderation";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { isMusicType, normalizeContentType } from "@/app/lib/contentTypes";
import {
  normalizeCoverInterval,
  sanitizeCovers,
  sanitizeLyrics,
} from "@/app/lib/musicTrack";
import {
  COPYRIGHT_SCREEN_REPORTER,
  combineCopyrightSignals,
  screenMusicMetadata,
} from "@/app/lib/musicCopyright";
import { getRequestIp } from "@/app/lib/requestInfo";
import { createNotification } from "@/app/lib/notifications";
import { applyModerationStrike } from "@/app/lib/moderationStrikes";
import { CUSTOM_AUDIO_MAX_SECONDS } from "@/app/data/soundtracks";
import {
  audienceFlags,
  audienceFromFlags,
  normalizeVideoAudience,
} from "@/app/lib/contentAccess";
import { classifyAudience, decideAudience } from "@/app/lib/audienceClassifier";

// Defensive re-validation of a client-supplied soundtrack pick (see
// ShortCreationTools/soundtracks.ts's ResolvedSoundtrack shape) before it's
// stored on the video item. Bounds every string field so a malicious/buggy
// request can't stuff an oversized blob into shortSettings — same spirit as
// THUMBNAIL_DATA_URL_MAX_LENGTH just above. Returns null for anything that
// doesn't look like a real track, which is exactly "no soundtrack" to every
// downstream reader (upload create, ShortsPageContent playback).
const SOUNDTRACK_STRING_MAX_LENGTH = 500;

function sanitizeSoundtrack(input: unknown): {
  id: string;
  title: string;
  artist: string;
  url: string;
  durationSeconds: number;
  source: "inplayer" | "jamendo" | "custom";
  licenseUrl?: string;
} | null {
  if (!input || typeof input !== "object") return null;
  const t = input as Record<string, unknown>;

  const isBoundedString = (v: unknown) =>
    typeof v === "string" && v.trim() && v.length <= SOUNDTRACK_STRING_MAX_LENGTH;

  if (!isBoundedString(t.id) || !isBoundedString(t.title) || !isBoundedString(t.artist) || !isBoundedString(t.url)) {
    return null;
  }
  if (t.source !== "inplayer" && t.source !== "jamendo" && t.source !== "custom") return null;
  if (typeof t.url === "string" && !/^https?:\/\//.test(t.url) && !t.url.startsWith("/")) return null;

  // Creator-supplied audio (an uploaded file or a pasted link) must be
  // served over HTTPS — a plain-http track would be blocked as mixed content
  // by the browser at playback anyway, so reject it here rather than storing
  // a soundtrack that can never be heard.
  if (t.source === "custom" && typeof t.url === "string" && !/^https:\/\//.test(t.url)) {
    return null;
  }

  const claimedDuration =
    typeof t.durationSeconds === "number" && Number.isFinite(t.durationSeconds) && t.durationSeconds > 0
      ? Math.min(t.durationSeconds, 3600)
      : 30;

  // Re-clamp the copyright cap server-side. Both players already enforce it
  // (see soundtrackClipSeconds), but a hand-crafted request must not be able
  // to publish a custom track that claims a longer playable duration.
  const durationSeconds =
    t.source === "custom" ? Math.min(claimedDuration, CUSTOM_AUDIO_MAX_SECONDS) : claimedDuration;

  return {
    id: (t.id as string).trim(),
    title: (t.title as string).trim(),
    artist: (t.artist as string).trim(),
    url: (t.url as string).trim(),
    durationSeconds,
    source: t.source,
    // A licence page only means anything for a Jamendo CC track — never
    // carry one over onto the creator's own audio.
    ...(t.source === "jamendo" &&
      isBoundedString(t.licenseUrl) && { licenseUrl: (t.licenseUrl as string).trim() }),
  };
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json(
      { error: "Please sign in to upload." },
      { status: 401 }
    );
  }
  
  await ensureUsername(user.userId);
  
  try {
    const body = await request.json();
    const {
      title,
      description,
      category,
      contentType,
      visibility,
      tags,
      audience,
      madeForKids,
      ageRestricted,
      commentsEnabled,
      spokenLanguage,
      shortSettings,
      thumbnailDataUrl,
      membersOnly,
      // Music-only. covers are S3 URLs already uploaded via
      // /api/music/cover; lyrics are creator-stamped lines; audioSha256 is
      // a browser-computed hash of the audio bytes used for duplicate
      // detection; declaredOwnership is the creator's attestation.
      covers,
      coverIntervalSeconds,
      lyrics,
      audioSha256,
      declaredOwnership,
    } = body;

    if (!title?.trim() || !category?.trim()) {
      return NextResponse.json(
        { error: "Title and category are required." },
        { status: 400 }
      );
    }

    // Music is an audio-only upload. It is longform (NOT a short, so it
    // lands in the main feed alongside videos), but it has no video track —
    // which changes exactly three things: the cover image is mandatory, Mux
    // is asked for an audio rendition instead of MP4s, and captions are
    // skipped. See app/lib/contentTypes.ts.
    //
    // Declared HERE rather than beside isShort further down, because the
    // cover check below needs it and a const is in its temporal dead zone
    // until its own line — declaring it later throws on every upload.
    const isMusic = isMusicType(contentType);

    // Optional creator-supplied thumbnail. Validated defensively even
    // though the client always sends output from compressImageToThumbnail
    // — a request could bypass the browser entirely.
    let customThumbnailUrl: string | null = null;
    if (thumbnailDataUrl !== undefined && thumbnailDataUrl !== null && thumbnailDataUrl !== "") {
      if (
        typeof thumbnailDataUrl !== "string" ||
        !thumbnailDataUrl.startsWith("data:image/") ||
        thumbnailDataUrl.length > THUMBNAIL_DATA_URL_MAX_LENGTH
      ) {
        return NextResponse.json(
          { error: "That thumbnail image is too large or invalid. Please try a different image." },
          { status: 400 }
        );
      }
      customThumbnailUrl = thumbnailDataUrl;
    }

    // A cover image is REQUIRED for music, with no fallback: Mux renders
    // thumbnails from video frames and an audio-only asset has none, so
    // without this the track publishes with a broken image everywhere it is
    // listed. Enforced server-side because a hand-made request skips the
    // upload form entirely.
    if (isMusic && !customThumbnailUrl) {
      return NextResponse.json(
        { error: "Music uploads need a cover image — audio has no video frame to make one from." },
        { status: 400 }
      );
    }

    // ── Music extras, all re-derived server-side ─────────────────────
    // Nothing the client sent is trusted: sanitizeCovers accepts only https
    // URLs (so a request can't point the player at javascript: or stuff a
    // megabyte data: blob into the item), sanitizeLyrics caps the line
    // count and length, and the interval is clamped to a sane range.
    const musicCovers = isMusic ? sanitizeCovers(covers) : [];
    const musicLyrics = isMusic ? sanitizeLyrics(lyrics) : [];
    const musicCoverInterval = isMusic ? normalizeCoverInterval(coverIntervalSeconds) : undefined;
    const musicHash =
      isMusic && typeof audioSha256 === "string" && /^[a-f0-9]{64}$/i.test(audioSha256)
        ? audioSha256.toLowerCase()
        : null;

    // ── Copyright screening (music only) ─────────────────────────────
    // Three checks, none of which can hear the audio — see the long note at
    // the top of app/lib/musicCopyright.ts for exactly why, and for the
    // seam where real fingerprinting plugs in later.
    //
    // A hit FLAGS FOR ADMIN REVIEW and nothing more: the track publishes
    // normally and appears in the Copyright Center. That is deliberate.
    // Metadata screening will sometimes suspect a genuine musician whose
    // own song is called "Cover", and a false positive must never stop a
    // real creator publishing their own work.
    let copyrightScreening = null;
    let duplicateOfVideoId: string | null = null;

    if (isMusic) {
      if (musicHash) {
        try {
          const dupe = await docClient.send(
            new ScanCommand({
              TableName: "InPlayer-Videos",
              FilterExpression: "audioSha256 = :h",
              ExpressionAttributeValues: { ":h": musicHash },
              ProjectionExpression: "videoId",
              Limit: 1,
            })
          );
          duplicateOfVideoId = (dupe.Items?.[0]?.videoId as string | undefined) || null;
        } catch (err) {
          // Fails open on purpose: a DynamoDB hiccup must not block a
          // legitimate upload. The worst case is a duplicate that nobody
          // caught automatically, which is where the Copyright Center and
          // rights-holder reports take over.
          console.error("Music duplicate check failed (non-fatal):", err);
        }
      }

      copyrightScreening = combineCopyrightSignals({
        metadata: screenMusicMetadata({
          title,
          description,
          tags,
          declaredOwnership,
        }),
        duplicateOfVideoId,
      });
    }

    // Snapshot the uploader's current avatar so video/short cards can show
    // it without an extra lookup per item. app/api/profile/sync keeps this
    // in sync if the uploader changes their photo later.
    const profileResult = await docClient.send(
      new GetCommand({
        TableName: "InPlayer-Users",
        Key: { userId: user.userId },
      })
    );
    const uploaderAvatarUrl = profileResult.Item?.avatarUrl || null;
    const isShort = contentType === "short";

    // Real-time auto-moderation on the title + description (app/lib/
    // moderation.ts) — this scans the submitted text, not the video content
    // itself. Fails open, so a moderation API hiccup never blocks a real
    // upload. A flagged upload still gets created and fully processed —
    // the creator can still see and manage it from My Videos — but it's
    // hidden from every public listing (app/lib/videoStore.ts) and from
    // direct watch links (app/watch/[videoId]/page.tsx) until an admin
    // reviews it in the Admin Panel's moderation queue.
    const platformSettings = await getPlatformSettings();
    const uploadModeration = platformSettings.moderationEnabledUploads
      ? await moderateText(`${title} ${description || ""}`)
      : UNCHECKED;
    // Automatic audience classification, reusing the moderation categories
    // already fetched just above — no second model call, no extra cost. It
    // compares what the creator declared (Everyone / Kids / 18+) against
    // what the AI reads the content as, and records any disagreement for
    // an admin. See app/lib/audienceClassifier.ts for the exact rules; the
    // one that matters most is that adult-signalled content can never stay
    // tagged Kids, however weak the signal.
    const declaredAudience =
      normalizeVideoAudience(audience) ?? audienceFromFlags(madeForKids, ageRestricted);
    const audienceDecision = decideAudience(
      declaredAudience,
      classifyAudience(`${title} ${description || ""}`, uploadModeration)
    );

    // Hidden from every public listing if EITHER the general moderation
    // check flagged it, the audience classifier decided this must not be
    // publicly visible pending review, OR the copyright screener flagged it.
    const moderationHidden =
      (uploadModeration.checked && uploadModeration.flagged) || audienceDecision.hide || (isMusic && copyrightScreening?.risk === "review");
    // Ground truth for which language the video is spoken in — trusted
    // over Mux's own "auto" detection by the caption pipeline (see
    // app/api/webhooks/mux), since Mux has no ASR model for Hindi/Bengali
    // and its guess for those is unreliable. Defaults to "auto" for
    // Shorts (which never get captions anyway) and any unrecognized value.
    const spokenLang = ["en", "hi", "bn"].includes(spokenLanguage)
      ? spokenLanguage
      : "auto";

    // Ask Mux for a one-time direct upload URL. The browser uploads the
    // actual video file straight to this URL — it never passes through
    // our own server, which matters a lot for large video files.
    //
    // Videos (not Shorts) also request three downloadable static MP4
    // renditions up front (1080p / 720p / 480p) so the viewer-facing
    // Download button can offer a quality picker. Mux automatically
    // "skips" any resolution higher than the source, so a 720p upload
    // simply won't produce a 1080p file — the button only ever shows the
    // qualities that actually became ready. See app/api/webhooks/mux for
    // the per-rendition "ready" callbacks and app/components/DownloadButton
    // for the viewer-facing side.
    const upload = await mux.video.uploads.create({
      cors_origin: "*", // Tighten this to your real domain before going fully live
      new_asset_settings: {
        // Videos (not Shorts) get a second, "signed" playback ID alongside
        // the public one — that's what makes "Members only" a real,
        // enforced gate (see app/api/videos/[videoId]/playback-token)
        // instead of just a UI toggle: the signed ID is useless to anyone
        // without a per-request token InPlayer's own server issues after
        // checking real membership status, unlike the public ID which
        // plays for anyone who has the URL regardless of app logic. Every
        // video still gets a public ID too, since most videos aren't
        // members-only and should keep working exactly as before.
        playback_policy: isShort ? ["public"] : ["public", "signed"],
        // Music: one audio-only downloadable rendition instead of the MP4
        // ladder. Asking Mux for "1080p" on an asset with no video track is
        // simply skipped and max_resolution_tier is meaningless here, but an
        // audio-only M4A is the real equivalent — and it is what makes the
        // existing Download button work for a track.
        ...(isMusic && {
          static_renditions: [{ resolution: "audio-only" }],
        }),
        ...(!isShort && !isMusic && {
          static_renditions: [
            { resolution: "1080p" },
            { resolution: "720p" },
            { resolution: "480p" },
          ],
          // Lets this asset be encoded/stored/streamed up to real 4K if the
          // source actually is 4K — Mux never upscales and bills by what's
          // actually delivered, so this costs nothing extra for the (today,
          // typical) 1080p-and-under upload. It's what makes "4K" a real,
          // working perk for paid members (see app/components/VideoPlayer.tsx's
          // maxResolutionTier prop) instead of a promise with nothing behind it.
          max_resolution_tier: "2160p",
        }),
      },
    });

    // Save a "processing" placeholder now, keyed by the Mux upload ID.
    // Mux's webhook (fired once transcoding finishes, usually a minute
    // or two later) will look up this same record by that same ID and
    // fill in the real playback details.
    await docClient.send(
      new PutCommand({
        TableName: "InPlayer-Videos",
        Item: {
          videoId: upload.id,
          status: "processing",
          title: title.trim(),
          description: description?.trim() || "",
          category: category.trim(),
          contentType: normalizeContentType(contentType),
          spokenLanguage: spokenLang,
          uploaderId: user.userId,
          uploaderName: user.name || "Unknown",
          uploaderAvatarUrl,
          uploadedAt: new Date().toISOString(),
          views: 0,
          // Denormalized counters kept in sync by app/api/likes and
          // app/api/comments (ADD on every real like/comment/unlike/delete)
          // so homepage/channel/Raftaar cards can show real engagement
          // numbers straight off the already-fetched video record — no
          // extra per-video Scan/Query needed just to render a card.
          likeCount: 0,
          commentCount: 0,
          ...(moderationHidden && {
            flagged: true,
            // The audience classifier's own reasons are folded in alongside
            // the raw moderation categories, so the admin queue explains
            // WHY something is here even when it was the audience mismatch
            // (not the policy check) that hid it.
            flaggedCategories: [
              ...uploadModeration.categories,
              ...(audienceDecision.audienceMismatch ? ["audience-mismatch"] : []),
              ...(isMusic && copyrightScreening?.risk === "review" ? ["copyright"] : []),
            ],
            moderationHidden: true,
            moderatedAt: new Date().toISOString(),
          }),
          // A mismatch that did NOT warrant hiding still needs a timestamp,
          // because the admin queue sorts on moderatedAt — without one these
          // rows would sort to the bottom on an invalid date.
          ...(audienceDecision.audienceMismatch &&
            !moderationHidden && { moderatedAt: new Date().toISOString() }),
          // A creator-picked thumbnail. customThumbnailUrl is the durable
          // "did the creator set one" marker — the Mux webhook's
          // video.asset.ready handler checks it via if_not_exists() so it
          // never overwrites a custom thumbnail once Mux finishes
          // processing. thumbnailUrl is set to the same value up front so
          // the video shows the right image immediately, even while still
          // "processing".
          // ── Music-only attributes ──────────────────────────────
          // Written only for a track, so a video's row is byte-identical
          // to what it was before this feature existed.
          ...(isMusic && {
            covers: musicCovers,
            coverIntervalSeconds: musicCoverInterval,
            lyrics: musicLyrics,
            ...(musicHash && { audioSha256: musicHash }),
            // The ownership attestation, with evidence. This is what gives
            // InPlayer its safe harbour if a rights holder ever complains,
            // so it records WHO said it, WHEN, and FROM WHERE — a bare
            // boolean would be worth nothing in that conversation.
            ownershipDeclared: declaredOwnership === true,
            ownershipDeclaredAt: new Date().toISOString(),
            ownershipDeclaredIp: getRequestIp(request) || "unknown",
            ...(copyrightScreening && copyrightScreening.risk === "review" && {
              copyrightRisk: "review",
              copyrightSignals: copyrightScreening.signals,
              moderationHidden: true, // Immediately hide from public until reviewed
              ...(duplicateOfVideoId && { duplicateOfVideoId }),
            }),
          }),
          ...(customThumbnailUrl && {
            customThumbnailUrl,
            thumbnailUrl: customThumbnailUrl,
          }),
          // "unavailable" for Shorts (never offered), "preparing" for
          // videos (the static renditions requested above are already in
          // flight), flips to "ready" once Mux's webhook confirms them.
          downloadStatus: isShort ? "unavailable" : "preparing",
          // Videos only: when the rendition was requested (so prepare-download
          // can tell a genuinely in-flight request apart from one stuck
          // because its webhook got silently lost — see STUCK_THRESHOLD_MS),
          // and an empty renditions map that the webhook fills in per quality
          // (resolution -> filename). Pre-creating the map lets the webhook
          // use a direct nested update without a read-merge race.
          ...(!isShort && {
            downloadRequestedAt: new Date().toISOString(),
            downloadRenditions: {},
          }),
          // Upload options (YouTube-style). DynamoDB needs no schema change
          // to store these new attributes.
          visibility: ["public", "unlisted", "private"].includes(visibility)
            ? visibility
            : "public",
          tags: Array.isArray(tags)
            ? tags
                .filter((t: unknown) => typeof t === "string" && t.trim())
                .slice(0, 15)
                .map((t: string) => t.trim())
            : [],
          // Who may see this video, platform-wide (app/lib/contentAccess.ts).
          // This is the AI-reconciled result, not the raw client value —
          // see audienceDecision above. madeForKids/ageRestricted are then
          // rewritten FROM it, so the three fields can never disagree.
          audience: audienceDecision.audience,
          ...audienceFlags(audienceDecision.audience),
          // What the creator actually picked, kept separately so an admin
          // reviewing a mismatch can see both sides rather than only the
          // corrected value.
          audienceDeclared: declaredAudience,
          audienceSuggested: audienceDecision.audienceSuggested,
          ...(audienceDecision.audienceMismatch && {
            audienceMismatch: true,
            audienceSignals: audienceDecision.audienceSignals.slice(0, 10),
          }),
          // Defaults to on unless explicitly disabled.
          commentsEnabled: commentsEnabled !== false,
          // Real member-only gating — see app/watch/[videoId]/page.tsx,
          // which checks this against the viewer's actual active
          // membership (app/lib/memberships.ts) before ever handing back
          // playback details. Shorts can't be members-only for now (the
          // Shorts feed has no per-item gating UI yet).
          ...(!isShort && { membersOnly: !!membersOnly }),
          // Background soundtrack + "Look" filter — originally Shorts-only,
          // now offered on Video uploads too (see ShortCreationTools /
          // app/upload/page.tsx), so this no longer gates on isShort. Kept
          // under the same `shortSettings` attribute name for both content
          // types deliberately: renaming it would mean updating every
          // already-published Short's existing data and every reader
          // (ShortsPageContent, app/shorts/page.tsx) for a purely cosmetic
          // naming win — not worth the risk of breaking something that
          // already works.
          ...(shortSettings && typeof shortSettings === "object" && {
            shortSettings: {
              // Full resolved track (id/title/artist/url/duration/source),
              // not just an id — see app/data/soundtracks.ts's
              // ResolvedSoundtrack comment for why: it lets already-published
              // Shorts/Videos play back without ever re-looking-up an
              // external (Jamendo) track later. Each field is type/length-
              // sanitized before it ever reaches DynamoDB, since this is a
              // raw client body a request could forge regardless of what
              // the picker UI actually sends.
              soundtrack: sanitizeSoundtrack(shortSettings.soundtrack),
              // musicClipSeconds only means anything for Shorts (a fixed
              // clip cut short of the source file's natural end — see
              // ShortsPageContent.tsx). Videos loop the whole track
              // instead (see VideoPlayer.tsx), so this is harmlessly
              // ignored for them but still stored for schema consistency.
              musicClipSeconds: shortSettings.musicClipSeconds === 20 ? 20 : 30,
              filter: ["original", "warm", "vivid", "mono"].includes(shortSettings.filter) ? shortSettings.filter : "original",
            },
          }),
        },
      })
    );

    if (moderationHidden) {
      const isOnlyCopyright =
        isMusic &&
        copyrightScreening?.risk === "review" &&
        !(uploadModeration.checked && uploadModeration.flagged) &&
        !audienceDecision.hide;

      if (!isOnlyCopyright) {
        await applyModerationStrike(
          request,
          user.userId,
          isShort ? "Short" : "video upload",
          uploadModeration.categories
        ).catch((err) => console.error("upload/create: applyModerationStrike failed:", err));
      }
    }

    // ── A flagged track goes into the Copyright Center ────────────────
    //
    // Not a new queue: the Copyright Center (app/admin/copyright) reads
    // InPlayer-Reports rows with reason "copyright" and status "open", and
    // already gives an admin Strike / Dismiss / Remove for each one, with
    // the uploader's running strike count and the auto-suspend at three.
    // Writing the screening result as a report means every one of those
    // behaviours applies to an auto-flagged track for free, and there is
    // exactly one place a human decides copyright on InPlayer.
    //
    // reporterId marks it as machine-raised so it is never confused with a
    // rights holder's own complaint. The track stays live and visible
    // throughout — see the screening note above for why a metadata hit
    // must never be an automatic takedown.
    if (isMusic && copyrightScreening?.risk === "review") {
      await docClient
        .send(
          new PutCommand({
            TableName: "InPlayer-Reports",
            Item: {
              reportId: randomUUID(),
              targetType: "video",
              videoId: upload.id,
              reporterId: COPYRIGHT_SCREEN_REPORTER,
              reason: "copyright",
              // Every signal, spelled out — this is the whole of what the
              // reviewer gets to judge on, so it says exactly what the
              // screen objected to rather than a count.
              details: ["Automatic screening:", ...copyrightScreening.signals.map((sig) => sig.detail)]
                .join(" ")
                .slice(0, 1000),
              status: "open",
              createdAt: new Date().toISOString(),
            },
          })
        )
        // Non-fatal by design. The upload has already succeeded at this
        // point; failing it because a review row couldn't be written would
        // punish the creator for our own outage. The flags are still on
        // the video item itself (copyrightRisk/copyrightSignals), so
        // nothing is lost permanently.
        .catch((err) =>
          console.error("upload/create: couldn't queue the copyright review:", err)
        );

        // Notify user
        await createNotification({
          userId: user.userId,
          type: "admin_announcement",
          message: "Your music upload has been flagged for a potential copyright match. It is hidden from the public until an admin reviews it.",
          videoId: upload.id
        }).catch(err => console.error("Failed to notify user", err));
    }

    return NextResponse.json({
      uploadUrl: upload.url,
      videoId: upload.id,
    });
  } catch (err: unknown) {
    console.error("Upload creation error:", err);

    // Surface Mux's own reason when there is one — e.g. "Free plan is
    // limited to 10 assets..." — so the uploader sees exactly what to fix
    // (delete old videos or upgrade the Mux plan) instead of a mystery
    // failure.
    const muxMsg = muxErrorMessages(err);

    return NextResponse.json(
      {
        error:
          muxMsg || "Something went wrong starting the upload. Please try again.",
      },
      { status: muxMsg ? 400 : 500 }
    );
  }
}
