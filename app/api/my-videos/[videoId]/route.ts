import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { THUMBNAIL_DATA_URL_MAX_LENGTH } from "@/app/lib/imageCompress";
import { deleteVideoCascade } from "@/app/lib/cascadeDelete";

const VISIBILITY_VALUES = ["public", "unlisted", "private"];
const SPOKEN_LANGUAGE_VALUES = ["auto", "en", "hi", "bn"];

interface Params {
  params: Promise<{ videoId: string }>;
}

async function verifyOwnership(videoId: string, userId: string) {
  const result = await docClient.send(
    new GetCommand({ TableName: "InPlayer-Videos", Key: { videoId } })
  );

  if (!result.Item) {
    return { error: "Video not found.", status: 404 } as const;
  }

  if (result.Item.uploaderId !== userId) {
    return { error: "You don't own this video.", status: 403 } as const;
  }

  return { video: result.Item } as const;
}

// GET was missing entirely — the Localization Console
// (app/creators/studio/[videoId]/localization/page.tsx) fetches this exact
// route with a plain GET on load. With no GET handler here, Next.js
// answered every request with 405, `res.ok` was always false, `video`
// stayed null, and the page rendered "Video not found." for every video,
// even ones the creator genuinely owned. This is the fix — same ownership
// check PATCH/DELETE already use, just returning the video instead of
// mutating it.
export async function GET(request: NextRequest, { params }: Params) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { videoId } = await params;
  const ownership = await verifyOwnership(videoId, user.userId);

  if ("error" in ownership) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  return NextResponse.json({ video: ownership.video });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { videoId } = await params;
  const ownership = await verifyOwnership(videoId, user.userId);

  if ("error" in ownership) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  const body = await request.json();
  const {
    title,
    description,
    category,
    tags,
    visibility,
    madeForKids,
    ageRestricted,
    commentsEnabled,
    spokenLanguage,
    thumbnailDataUrl,
    thumbnailUrl,
    membersOnly,
  } = body;

  if (!title?.trim() || !category?.trim()) {
    return NextResponse.json(
      { error: "Title and category are required." },
      { status: 400 }
    );
  }

  if (visibility !== undefined && !VISIBILITY_VALUES.includes(visibility)) {
    return NextResponse.json({ error: "Invalid visibility." }, { status: 400 });
  }

  if (
    thumbnailDataUrl !== undefined &&
    thumbnailDataUrl !== null &&
    thumbnailDataUrl !== "" &&
    (typeof thumbnailDataUrl !== "string" ||
      !thumbnailDataUrl.startsWith("data:image/") ||
      thumbnailDataUrl.length > THUMBNAIL_DATA_URL_MAX_LENGTH)
  ) {
    return NextResponse.json(
      { error: "That thumbnail image is too large or invalid. Please try a different image." },
      { status: 400 }
    );
  }

  // Same field set the Upload page collects, so the edit panel can offer
  // true parity (see app/components/VideoMetadataFields.tsx, shared by
  // both). contentType is deliberately never accepted here — changing it
  // after upload would desync the static-rendition/captions pipeline,
  // which is keyed off the value chosen at creation time.
  const sets: string[] = [
    "title = :title",
    "description = :description",
    "category = :category",
  ];
  const values: Record<string, unknown> = {
    ":title": title.trim(),
    ":description": description?.trim() || "",
    ":category": category.trim(),
  };

  if (Array.isArray(tags)) {
    sets.push("tags = :tags");
    values[":tags"] = tags
      .filter((t: unknown) => typeof t === "string" && t.trim())
      .slice(0, 15)
      .map((t: string) => t.trim());
  }
  if (visibility !== undefined) {
    sets.push("visibility = :visibility");
    values[":visibility"] = visibility;
  }
  if (madeForKids !== undefined) {
    sets.push("madeForKids = :madeForKids");
    values[":madeForKids"] = !!madeForKids;
  }
  if (ageRestricted !== undefined) {
    sets.push("ageRestricted = :ageRestricted");
    values[":ageRestricted"] = !!ageRestricted;
  }
  if (commentsEnabled !== undefined) {
    sets.push("commentsEnabled = :commentsEnabled");
    values[":commentsEnabled"] = !!commentsEnabled;
  }
  if (spokenLanguage !== undefined && SPOKEN_LANGUAGE_VALUES.includes(spokenLanguage)) {
    sets.push("spokenLanguage = :spokenLanguage");
    values[":spokenLanguage"] = spokenLanguage;
  }
  // Shorts never send this (see app/upload/page.tsx / my-videos/page.tsx),
  // so a real, already-published Short can't accidentally get gated by a
  // stray value here.
  if (membersOnly !== undefined) {
    sets.push("membersOnly = :membersOnly");
    values[":membersOnly"] = !!membersOnly;
  }
  if (
    typeof thumbnailDataUrl === "string" &&
    thumbnailDataUrl.startsWith("data:image/")
  ) {
    sets.push("customThumbnailUrl = :thumb", "thumbnailUrl = :thumb");
    values[":thumb"] = thumbnailDataUrl;
  } else if (
    typeof thumbnailUrl === "string" &&
    thumbnailUrl.startsWith("https://image.mux.com/")
  ) {
    // Creator selected a frame generated by Mux.
    sets.push("thumbnailUrl = :thumb");
    values[":thumb"] = thumbnailUrl;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeValues: values,
    })
  );

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { videoId } = await params;
  const ownership = await verifyOwnership(videoId, user.userId);

  if ("error" in ownership) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  // Real, full deletion — the Mux asset AND every row anywhere in the app
  // that references this video (comments, likes, watch history, playlist
  // entries, notifications, reports, daily view stats), not just the
  // video row itself. Shared with the admin delete (app/api/admin/videos)
  // so both stay identical — see app/lib/cascadeDelete.ts.
  const result = await deleteVideoCascade(videoId);
  if (!result.success) {
    console.error(`Video ${videoId} delete had partial failures:`, result.errors);
  }

  return NextResponse.json({ success: true, warnings: result.errors });
}