// The three kinds of thing a creator can publish.
//
// THIS FILE IS PURE — no DynamoDB, no next/*, so the upload form, the API
// routes, the player and the homepage all narrow the same union the same
// way and can't drift apart on what counts as what.
//
// "music" is the newest of the three: an MP3/audio upload that behaves like
// a video in every respect except that there are no video frames. Mux
// ingests audio-only files perfectly happily and returns the same HLS
// playback ID, so the whole existing pipeline — direct upload, webhook,
// muxPlaybackId, the player, likes, comments, playlists, watchlist,
// history, trending, search, audience classification, Premium gating —
// carries over untouched.
//
// WHY THAT WORKED SO CHEAPLY: nearly every contentType check in the
// codebase was already written as `=== "short"` or `!== "short"`, i.e. a
// binary "is this the vertical feed or not". Music lands on the "not short"
// side of every one of those, which is exactly right — it belongs in the
// main feed, in Up Next, in the History "Videos" tab, and in the longform
// counters. Only the handful of places that genuinely need to tell music
// apart from video were changed, and they all call into this file.
//
// The three real differences from a video, and nothing else:
//   1. A cover image is REQUIRED at upload. Mux cannot generate a thumbnail
//      from an asset with no video track, so there is no fallback.
//   2. Mux is asked for an audio-only static rendition rather than
//      1080p/720p/480p MP4s, and no max_resolution_tier (meaningless here).
//   3. No automatic captions — running speech recognition over a song
//      costs money and produces nonsense.

export type ContentType = "video" | "short" | "music";

export const CONTENT_TYPES: ContentType[] = ["video", "short", "music"];

/** Anything unrecognised becomes "video" — the safe, most-capable default,
 *  and what every row written before this feature existed already is. */
export function normalizeContentType(raw: unknown): ContentType {
  return raw === "short" || raw === "music" ? raw : "video";
}

export function isShortType(raw: unknown): boolean {
  return normalizeContentType(raw) === "short";
}

export function isMusicType(raw: unknown): boolean {
  return normalizeContentType(raw) === "music";
}

/** True for the two longform types — i.e. everything the main feed, Up Next
 *  and the History "Videos" tab should contain. This is the positive way of
 *  writing the `!== "short"` test that is scattered through the codebase. */
export function isLongformType(raw: unknown): boolean {
  return !isShortType(raw);
}

/** Title-case label for admin tables, creator library chips and buttons. */
export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  video: "Video",
  short: "Short",
  music: "Music",
};

/** Lowercase, for mid-sentence copy ("Uploading your music…"). */
export const CONTENT_TYPE_WORD: Record<ContentType, string> = {
  video: "video",
  short: "short",
  music: "track",
};

/** Where an item of this type is watched/played. Shorts live in the vertical
 *  feed; music plays on the ordinary watch page, same as a video. */
export function watchHrefFor(contentType: unknown, videoId: string): string {
  return isShortType(contentType) ? `/shorts?v=${videoId}` : `/watch/${videoId}`;
}

// What the file picker should accept for each type. Music deliberately
// accepts the containers Mux lists as supported audio inputs; "audio/*" is
// included last as a catch-all because browsers report the same file with
// different MIME types across platforms (an .m4a is variously audio/mp4,
// audio/x-m4a or audio/aac).
export const UPLOAD_ACCEPT: Record<ContentType, string> = {
  video: "video/*",
  short: "video/*",
  music: ".mp3,.m4a,.aac,.wav,.flac,.ogg,audio/*",
};
