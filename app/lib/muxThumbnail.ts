const MUX_THUMBNAIL_QUERY =
  "width=640&height=360&fit_mode=smartcrop&time=1";

/**
 * Builds the public Mux thumbnail URL from the playback ID, never the asset
 * or upload ID. Public assets do not need a signed image token.
 */
export function getMuxThumbnailUrl(playbackId: string): string | null {
  const id = playbackId.trim();

  if (!id) {
    return null;
  }

  return `https://image.mux.com/${encodeURIComponent(id)}/thumbnail.webp?${MUX_THUMBNAIL_QUERY}`;
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
