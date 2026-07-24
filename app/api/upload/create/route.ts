import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import mux, { muxErrorMessages } from "@/app/lib/mux";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { THUMBNAIL_DATA_URL_MAX_LENGTH } from "@/app/lib/imageCompress";
import { ensureUsername } from "@/app/lib/ensureUsername";

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
      thumbnailDataUrl,
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
        playback_policy: ["public"],
        ...(!isShort && {
          static_renditions: [
            { resolution: "1080p" },
            { resolution: "720p" },
            { resolution: "480p" },
          ],
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
        },
      })
    );

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