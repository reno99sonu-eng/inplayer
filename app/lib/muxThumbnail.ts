const LANDSCAPE_THUMBNAIL_QUERY =
  "width=640&height=360&fit_mode=smartcrop&time=1";
// Shorts are portrait (9:16) source video, not landscape. This used to
// request the SAME 640x360 (16:9) crop for Shorts as for regular videos —
// Mux's smartcrop then had to squeeze a tall vertical frame into a wide
// landscape box, and the app's own Shorts cards (aspect-[9/16], see
// ShortsShelf.tsx) then object-cover'd that already oddly-cropped landscape
// image back into a tall portrait card, scaling it up a lot to cover the
// height. The combination is what read as "stretched"/distorted thumbnails
// on the homepage Shorts row. Requesting a properly portrait-shaped crop
// from Mux directly (640x1138 ≈ 9:16) fixes it at the source instead of
// trying to patch it with CSS.
const PORTRAIT_THUMBNAIL_QUERY =
  "width=640&height=1138&fit_mode=smartcrop&time=1";

/**
 * Builds the public Mux thumbnail URL from the playback ID, never the asset
 * or upload ID. Public assets do not need a signed image token.
 */
export function getMuxThumbnailUrl(
  playbackId: string,
  isPortrait = false
): string | null {
  const id = playbackId.trim();

  if (!id) {
    return null;
  }

  const query = isPortrait ? PORTRAIT_THUMBNAIL_QUERY : LANDSCAPE_THUMBNAIL_QUERY;
  return `https://image.mux.com/${encodeURIComponent(id)}/thumbnail.webp?${query}`;
}

/**
 * Builds a handful of candidate thumbnail frame URLs spread across a known
 * asset duration, so a creator (or the AI thumbnail picker) has real
 * options instead of only ever seeing Mux's default first-second frame.
 * Used once Mux has actually finished processing an asset — see
 * app/components/UploadThumbnailStep.tsx and the "Generate AI Thumbnail"
 * button in VideoMetadataFields.
 *
 * Falls back to a small fixed set of early timestamps when the duration
 * isn't known yet (e.g. legacy rows uploaded before `duration` was stored),
 * same as the edit panel's previous hardcoded list.
 */
export function getMuxThumbnailCandidates(
  playbackId: string,
  durationSeconds?: number | null,
  count = 5
): string[] {
  const id = playbackId.trim();
  if (!id) return [];

  const times =
    durationSeconds && durationSeconds > 1
      ? Array.from({ length: count }, (_, i) => {
          // Spread across the middle 80% of the video — the very first/last
          // instants are disproportionately likely to be black frames,
          // intro cards, or motion blur from a cut.
          const fraction = (i + 1) / (count + 1);
          return Math.max(
            1,
            Math.round(durationSeconds * 0.1 + durationSeconds * 0.8 * fraction)
          );
        })
      : [1, 2, 5, 10, 15].slice(0, count);

  return Array.from(new Set(times)).map(
    (t) =>
      `https://image.mux.com/${encodeURIComponent(id)}/thumbnail.jpg?width=640&height=360&fit_mode=smartcrop&time=${t}`
  );
}
