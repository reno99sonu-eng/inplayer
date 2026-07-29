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
  // Soundtrack chosen at upload time (see ShortCreationTools). Absent/null
  // on both fields means "play with its own original audio, no soundtrack
  // attached."
  //
  // `soundtrack` is the current, full-object form (id/title/artist/url/
  // duration/source) — set for every Short uploaded after the Jamendo
  // real-music integration shipped, and resolved directly at playback time
  // with no external lookup needed (see ShortsPageContent.tsx).
  soundtrack?: {
    id: string;
    title: string;
    artist: string;
    url: string;
    durationSeconds: number;
    source: "inplayer" | "jamendo";
    licenseUrl?: string;
  } | null;
  // `soundtrackId` is the legacy, id-only form used by Shorts published
  // before that change — kept so those older items still resolve against
  // InPlayer's local catalog (app/data/soundtracks.ts's getSoundtrackById)
  // instead of losing their soundtrack entirely.
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