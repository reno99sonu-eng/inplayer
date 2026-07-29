// Single source of truth for InPlayer's Shorts soundtrack catalog — shared
// by the upload picker (app/components/ShortCreationTools.tsx) and actual
// Shorts playback (app/components/ShortsPageContent.tsx), so a track ID
// saved at upload time always resolves to the same real audio file.
//
// Every track here is 100% original, generated programmatically for this
// app (simple synthesized chord loops/arpeggios/drums) — not sampled or
// licensed from anywhere — so there is zero third-party rights risk, unlike
// the placeholder {id, title, artist}-only entries this replaced, which had
// no audio file behind them at all.
export interface Soundtrack {
  id: string;
  title: string;
  artist: string;
  mood: string;
  /** Public URL under /public, playable directly by an <audio> element. */
  url: string;
  /** Full length of the source file, in seconds. */
  durationSeconds: number;
}

// The shape actually stored on a Short once a track is picked at upload
// time — either one of the local, always-safe InPlayer instrumentals
// above, or a real track found via the "search real music" tab (see
// app/api/music/search, backed by Jamendo's free Creative Commons
// catalog). Storing the resolved fields directly (not just an id) means
// playback never needs to re-look-up an external track later — see the
// comment on ResolvedSoundtrack's only consumer, ShortsPageContent.tsx.
export interface ResolvedSoundtrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  durationSeconds: number;
  source: "inplayer" | "jamendo";
  /** Only set for source: "jamendo" — the track's specific CC license page. */
  licenseUrl?: string;
}

export function toResolvedSoundtrack(track: Soundtrack): ResolvedSoundtrack {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    url: track.url,
    durationSeconds: track.durationSeconds,
    source: "inplayer",
  };
}

export const SOUNDTRACKS: Soundtrack[] = [
  { id: "sunset-drive", title: "Sunset Drive", artist: "InPlayer Sounds", mood: "Chill", url: "/sounds/sunset-drive.mp3", durationSeconds: 30 },
  { id: "late-night", title: "Late Night Loop", artist: "InPlayer Sounds", mood: "Chill", url: "/sounds/late-night.mp3", durationSeconds: 30 },
  { id: "morning-coffee", title: "Morning Coffee", artist: "InPlayer Sounds", mood: "Chill", url: "/sounds/morning-coffee.mp3", durationSeconds: 30 },
  { id: "bright-day", title: "Bright Day", artist: "InPlayer Sounds", mood: "Uplifting", url: "/sounds/bright-day.mp3", durationSeconds: 30 },
  { id: "neon-pulse", title: "Neon Pulse", artist: "InPlayer Sounds", mood: "Energetic", url: "/sounds/neon-pulse.mp3", durationSeconds: 30 },
  { id: "cinematic-rise", title: "Cinematic Rise", artist: "InPlayer Sounds", mood: "Cinematic", url: "/sounds/cinematic-rise.mp3", durationSeconds: 30 },
  { id: "groove-street", title: "Groove Street", artist: "InPlayer Sounds", mood: "Groovy", url: "/sounds/groove-street.mp3", durationSeconds: 30 },
  { id: "dreamy-haze", title: "Dreamy Haze", artist: "InPlayer Sounds", mood: "Dreamy", url: "/sounds/dreamy-haze.mp3", durationSeconds: 30 },
];

export function getSoundtrackById(id: string | null | undefined): Soundtrack | null {
  if (!id) return null;
  return SOUNDTRACKS.find((track) => track.id === id) || null;
}

export function searchSoundtracks(query: string): Soundtrack[] {
  const q = query.trim().toLowerCase();
  if (!q) return SOUNDTRACKS;
  return SOUNDTRACKS.filter(
    (track) =>
      track.title.toLowerCase().includes(q) ||
      track.artist.toLowerCase().includes(q) ||
      track.mood.toLowerCase().includes(q)
  );
}
