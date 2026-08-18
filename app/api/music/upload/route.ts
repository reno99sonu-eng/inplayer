import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { getS3Client } from "@/app/lib/s3";
import { verifyAuth } from "@/app/lib/verifyAuth";
import { CUSTOM_AUDIO_MAX_SECONDS } from "@/app/data/soundtracks";

// Creator-supplied audio for the "Your own music" picker in
// ShortCreationTools.tsx — the third source alongside InPlayer's own
// synthesized instrumentals (app/data/soundtracks.ts) and Creative Commons
// search (app/api/music/search). Whatever lands here only ever plays for
// CUSTOM_AUDIO_MAX_SECONDS at a time, enforced in both players; see
// soundtrackClipSeconds in app/data/soundtracks.ts.
//
// STORAGE SETUP (this route no-ops safely until it's done):
// Set S3_MEDIA_BUCKET to a bucket in AWS_REGION whose `custom-audio/*`
// prefix is publicly readable, e.g. a bucket policy of
//   { "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
//     "Resource": "arn:aws:s3:::<bucket>/custom-audio/*" }
// Optionally set S3_MEDIA_PUBLIC_BASE_URL to serve it through CloudFront or
// a custom domain instead of the raw S3 hostname. Until S3_MEDIA_BUCKET
// exists this returns a clean 501 and the picker quietly falls back to
// link-only mode — nothing else in the app changes or breaks.
const AUDIO_PREFIX = "custom-audio";

// Vercel's serverless request body ceiling is 4.5MB, so stay under it with
// room for the multipart envelope. A 29-second clip is a few hundred KB at
// any sane bitrate, and even a whole 3-minute track at 192kbps fits — so
// this is generous rather than restrictive in practice.
const MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
};

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in to upload music." }, { status: 401 });
  }

  const bucket = process.env.S3_MEDIA_BUCKET;
  if (!bucket) {
    return NextResponse.json(
      {
        error:
          "Uploading your own audio file isn't switched on yet — paste a direct link to your track instead.",
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
    console.error("Custom audio upload: couldn't read form data:", err);
    return NextResponse.json({ error: "Couldn't read that file. Please try again." }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "No audio file was attached." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That file is too large. Please keep it under ${Math.floor(MAX_BYTES / (1024 * 1024))}MB.` },
      { status: 400 }
    );
  }

  const contentType = (file.type || "").toLowerCase();
  const extension = ALLOWED_TYPES[contentType];
  if (!extension) {
    return NextResponse.json(
      { error: "That doesn't look like an audio file. Use an MP3, M4A, WAV, OGG or FLAC." },
      { status: 400 }
    );
  }

  const key = `${AUDIO_PREFIX}/${user.userId}/${randomUUID()}.${extension}`;

  try {
    const body = new Uint8Array(await file.arrayBuffer());
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Long cache: the key is a fresh UUID every upload, so the object at
        // any given URL is immutable.
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  } catch (err) {
    console.error("Custom audio upload: S3 put failed:", err);
    return NextResponse.json(
      { error: "Couldn't save that file right now. Please try again." },
      { status: 502 }
    );
  }

  const base = process.env.S3_MEDIA_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  const url = base
    ? `${base}/${key}`
    : `https://${bucket}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${key}`;

  // durationSeconds is reported as the cap rather than the file's real
  // length on purpose: nothing downstream is allowed to play more than this
  // anyway, and it keeps the stored item honest about what will actually be
  // heard. The browser has already measured the real duration for its own
  // preview before getting here.
  return NextResponse.json({
    track: {
      id: `custom:${key}`,
      title: file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "My audio",
      artist: "Your own music",
      url,
      durationSeconds: CUSTOM_AUDIO_MAX_SECONDS,
      source: "custom" as const,
    },
  });
}
