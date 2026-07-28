export interface Short {
  id: number | string;
  title: string;
  creator: string;
  poster: string;
  views: string;
  likes: string;
  comments: string;
  videoId?: string; // present only for real uploaded shorts — used to link to /watch/[videoId]
  muxPlaybackId?: string; // present only for real uploaded shorts — used for actual playback
  uploaderId?: string; // present only for real uploaded shorts
  uploaderUsername?: string; // present only when the uploader has a username set — see app/lib/resolveUsernames
  uploaderAvatarUrl?: string; // present only for real uploaded shorts
  description?: string; // present only for real uploaded shorts
  // Soundtrack chosen at upload time (see ShortCreationTools) — resolved
  // against app/data/soundtracks.ts for actual playback. Absent/null means
  // "play with its own original audio, no soundtrack attached."
  soundtrackId?: string | null;
  musicClipSeconds?: 20 | 30;
}

// No example/dummy shorts — the Shorts shelf is real-shorts-only. Real
// DynamoDB-sourced shorts are passed in via the `realShorts` prop (see
// RecommendationFeed.tsx), which still spreads this array in alongside
// them; kept as an empty array (rather than removing the merge entirely)
// so a future curated/editorial shorts list can be added here without
// any component changes.
export const shorts: Short[] = [];