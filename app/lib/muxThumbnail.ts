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
