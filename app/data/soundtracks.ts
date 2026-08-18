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

// Hard playback ceiling for creator-supplied audio — anything with
// source: "custom", i.e. a file the creator uploaded themselves or a link
// they pasted in. InPlayer has no licence for that audio, so playback never
// runs past this point: the clip wraps back to 0 instead, exactly the way
// the existing 20s/30s Shorts clip length already works. 29s deliberately
// sits just under the ~30s clip length the major platforms settled on for
// unlicensed music snippets.
//
// This is a PLAYBACK cap, enforced in every player (ShortsPageContent.tsx
// and VideoPlayer.tsx) and re-clamped server-side in
// app/api/upload/create/route.ts so a hand-crafted request can't publish a
// custom track claiming a longer duration.
export const CUSTOM_AUDIO_MAX_SECONDS = 29;

// The shape actually stored on a Short once a track is picked at upload
// time — one of the local, always-safe InPlayer instrumentals above, a real
// track found via the "search real music" tab (see app/api/music/search,
// backed by Jamendo's free Creative Commons catalog), or the creator's own
// audio (an upload or a pasted link — capped at CUSTOM_AUDIO_MAX_SECONDS).
// Storing the resolved fields directly (not just an id) means playback never
// needs to re-look-up an external track later — see the comment on
// ResolvedSoundtrack's only consumer, ShortsPageContent.tsx.
export type SoundtrackSource = "inplayer" | "jamendo" | "custom";

export interface ResolvedSoundtrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  durationSeconds: number;
  source: SoundtrackSource;
  /** Only set for source: "jamendo" — the track's specific CC license page. */
  licenseUrl?: string;
}

// Single place that answers "how many seconds of this track may play before
// it wraps back to the start?", so the Shorts feed and the long-form player
// can't drift apart on the copyright cap.
//
// - requestedSeconds is the creator's own choice where one exists (Shorts'
//   20s/30s control). Pass null for long-form video, which has no such
//   control and otherwise just loops the whole track.
// - A custom track is ALWAYS additionally clamped to CUSTOM_AUDIO_MAX_SECONDS,
//   whatever the creator asked for and whatever duration the item claims.
// - Returns null for "no cap needed, let it loop naturally", which keeps the
//   pre-existing behaviour byte-for-byte for licensed InPlayer/Jamendo tracks
//   in the long-form player.
export function soundtrackClipSeconds(
  track: { source?: string | null; durationSeconds?: number | null } | null | undefined,
  requestedSeconds?: number | null
): number | null {
  if (!track) return null;

  let cap = Number.POSITIVE_INFINITY;

  if (typeof requestedSeconds === "number" && Number.isFinite(requestedSeconds) && requestedSeconds > 0) {
    cap = requestedSeconds;
  }

  if (track.source === "custom") {
    cap = Math.min(cap, CUSTOM_AUDIO_MAX_SECONDS);
  }

  // No cap from either source means "let it loop naturally" — deliberately
  // do NOT fall back to the item's recorded durationSeconds here. That field
  // is metadata (Jamendo's own reported length, or a default of 30) and can
  // disagree with the real file; treating it as a cut-off point would start
  // truncating already-published licensed tracks, which is exactly the
  // pre-existing behaviour this must not change.
  if (!Number.isFinite(cap)) return null;

  if (
    typeof track.durationSeconds === "number" &&
    Number.isFinite(track.durationSeconds) &&
    track.durationSeconds > 0
  ) {
    cap = Math.min(cap, track.durationSeconds);
  }

  return cap;
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
