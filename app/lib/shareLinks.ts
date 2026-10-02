/** Stable public entry point used by all content share actions. */
export const INPLAYER_WEB_ORIGIN = "https://inplayer.in";

export function sharedContentPath(videoId: string): string {
  return `/open/${encodeURIComponent(videoId)}`;
}

export function sharedContentUrl(videoId: string): string {
  return `${INPLAYER_WEB_ORIGIN}${sharedContentPath(videoId)}`;
}
