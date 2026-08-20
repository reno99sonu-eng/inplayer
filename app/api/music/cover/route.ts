import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { getS3Client } from "@/app/lib/s3";
import { verifyAuth } from "@/app/lib/verifyAuth";

// Cover art for a music upload. Up to MAX_COVERS of these per track (see
// app/lib/musicTrack.ts); the player crossfades between them on a timer the
// creator sets.
//
// WHY S3 AND NOT DYNAMODB, unlike the ordinary video thumbnail: a video has
// exactly one thumbnail and it is stored as a compressed data URL capped at
// 200KB (THUMBNAIL_DATA_URL_MAX_LENGTH). Five of those would be a megabyte
// inside a single item, and DynamoDB's hard item ceiling is 400KB — the
// upload would simply be rejected. So covers go to the same bucket the
// custom-audio feature already uses, and only their URLs are stored.
//
// STORAGE SETUP — identical to app/api/music/upload, and this route no-ops
// safely until it's done. S3_MEDIA_BUCKET must be a bucket in AWS_REGION
// whose `music-covers/*` prefix is publicly readable:
//   { "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
//     "Resource": "arn:aws:s3:::<bucket>/music-covers/*" }
// The existing policy for `custom-audio/*` can simply gain a second
// resource line. Optionally set S3_MEDIA_PUBLIC_BASE_URL for CloudFront.
const COVER_PREFIX = "music-covers";

// The browser re-encodes every cover before it gets here (see
// compressCoverImage in the upload tools) — a 1600px JPEG at q0.85 lands a
// few hundred KB. This ceiling is the backstop for a request that skipped
// the form, and sits under Vercel's ~4.5MB body limit with room to spare.
const MAX_BYTES = 3 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in to upload cover art." }, { status: 401 });
  }

  const bucket = process.env.S3_MEDIA_BUCKET;
  if (!bucket) {
    return NextResponse.json(
      {
        error: "Cover uploads aren't switched on yet. Please try again shortly.",
        debug: "S3_MEDIA_BUCKET is not set",
      },
      { status: 501 }
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (candidate instanceof File) file = candidate;
  } catch (err) {
    console.error("Music cover upload: couldn't read form data:", err);
    return NextResponse.json({ error: "Couldn't read that image. Please try again." }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "No image was attached." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That image file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That image is too large even after compression. Please try a different one." },
      { status: 400 }
    );
  }

  const contentType = (file.type || "").toLowerCase();
  const extension = ALLOWED_TYPES[contentType];
  if (!extension) {
    return NextResponse.json(
      { error: "That doesn't look like an image. Use a JPG, PNG or WebP." },
      { status: 400 }
    );
  }

  const key = `${COVER_PREFIX}/${user.userId}/${randomUUID()}.${extension}`;

  try {
    const body = new Uint8Array(await file.arrayBuffer());
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // The key is a fresh UUID every time, so whatever sits at a given
        // URL can never change.
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  } catch (err) {
    console.error("Music cover upload: S3 put failed:", err);
    return NextResponse.json(
      { error: "Couldn't save that image right now. Please try again." },
      { status: 502 }
    );
  }

  const base = process.env.S3_MEDIA_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  const url = base
    ? `${base}/${key}`
    : `https://${bucket}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${key}`;

  return NextResponse.json({ url });
}
