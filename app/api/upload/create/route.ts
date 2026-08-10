import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import mux, { muxErrorMessages } from "@/app/lib/mux";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { THUMBNAIL_DATA_URL_MAX_LENGTH } from "@/app/lib/imageCompress";
import { ensureUsername } from "@/app/lib/ensureUsername";
import { moderateText, UNCHECKED } from "@/app/lib/moderation";
import { getPlatformSettings } from "@/app/lib/platformSettings";
import { applyModerationStrike } from "@/app/lib/moderationStrikes";

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
  source: "inplayer" | "jamendo";
  licenseUrl?: string;
} | null {
  if (!input || typeof input !== "object") return null;
  const t = input as Record<string, unknown>;

  const isBoundedString = (v: unknown) =>
    typeof v === "string" && v.trim() && v.length <= SOUNDTRACK_STRING_MAX_LENGTH;

  if (!isBoundedString(t.id) || !isBoundedString(t.title) || !isBoundedString(t.artist) || !isBoundedString(t.url)) {
    return null;
  }
  if (t.source !== "inplayer" && t.source !== "jamendo") return null;
  if (typeof t.url === "string" && !/^https?:\/\//.test(t.url) && !t.url.startsWith("/")) return null;

  const durationSeconds =
    typeof t.durationSeconds === "number" && Number.isFinite(t.durationSeconds) && t.durationSeconds > 0
      ? Math.min(t.durationSeconds, 3600)
      : 30;

  return {
    id: (t.id as string).trim(),
    title: (t.title as string).trim(),
    artist: (t.artist as string).trim(),
    url: (t.url as string).trim(),
    durationSeconds,
    source: t.source,
    ...(isBoundedString(t.licenseUrl) && { licenseUrl: (t.licenseUrl as string).trim() }),
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
      madeForKids,
      ageRestricted,
      commentsEnabled,
      spokenLanguage,
      shortSettings,
      thumbnailDataUrl,
      membersOnly,
    } = body;

    if (!title?.trim() || !category?.trim()) {
      return NextResponse.json(
        { error: "Title and category are required." },
        { status: 400 }
      );
    }

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
    const moderationHidden = uploadModeration.checked && uploadModeration.flagged;
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
        ...(!isShort && {
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
          contentType: isShort ? "short" : "video",
          spokenLanguage: spokenLang,
          uploaderId: user.userId,
          uploaderName: user.name || "Unknown",
          uploaderAvatarUrl,
          uploadedAt: new Date().toISOString(),
          views: 0,
          ...(moderationHidden && {
            flagged: true,
            flaggedCategories: uploadModeration.categories,
            moderationHidden: true,
            moderatedAt: new Date().toISOString(),
          }),
          // A creator-picked thumbnail. customThumbnailUrl is the durable
          // "did the creator set one" marker — the Mux webhook's
          // video.asset.ready handler checks it via if_not_exists() so it
          // never overwrites a custom thumbnail once Mux finishes
          // processing. thumbnailUrl is set to the same value up front so
          // the video shows the right image immediately, even while still
          // "processing".
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
          madeForKids: !!madeForKids,
          ageRestricted: !!ageRestricted,
          // Defaults to on unless explicitly disabled.
          commentsEnabled: commentsEnabled !== false,
          // Real member-only gating — see app/watch/[videoId]/page.tsx,
          // which checks this against the viewer's actual active
          // membership (app/lib/memberships.ts) before ever handing back
          // playback details. Shorts can't be members-only for now (the
          // Shorts feed has no per-item gating UI yet).
          ...(!isShort && { membersOnly: !!membersOnly }),
          ...(isShort && shortSettings && typeof shortSettings === "object" && {
            shortSettings: {
              // Full resolved track (id/title/artist/url/duration/source),
              // not just an id — see app/data/soundtracks.ts's
              // ResolvedSoundtrack comment for why: it lets already-published
              // Shorts play back without ever re-looking-up an external
              // (Jamendo) track later. Each field is type/length-sanitized
              // before it ever reaches DynamoDB, since this is a raw client
              // body a request could forge regardless of what the picker UI
              // actually sends.
              soundtrack: sanitizeSoundtrack(shortSettings.soundtrack),
              musicClipSeconds: shortSettings.musicClipSeconds === 20 ? 20 : 30,
              filter: ["original", "warm", "vivid", "mono"].includes(shortSettings.filter) ? shortSettings.filter : "original",
            },
          }),
        },
      })
    );

    if (moderationHidden) {
      await applyModerationStrike(
        request,
        user.userId,
        isShort ? "Short" : "video upload",
        uploadModeration.categories
      ).catch((err) => console.error("upload/create: applyModerationStrike failed:", err));
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
