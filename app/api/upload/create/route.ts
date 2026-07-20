import { NextRequest, NextResponse } from "next/server";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import mux from "@/app/lib/mux";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";

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
    } = body;

    if (!title?.trim() || !category?.trim()) {
      return NextResponse.json(
        { error: "Title and category are required." },
        { status: 400 }
      );
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
          uploaderId: user.userId,
          uploaderName: user.name || "Unknown",
          uploaderAvatarUrl,
          uploadedAt: new Date().toISOString(),
          views: 0,
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
    return NextResponse.json(
      { error: "Something went wrong starting the upload. Please try again." },
      { status: 500 }
    );
  }
}