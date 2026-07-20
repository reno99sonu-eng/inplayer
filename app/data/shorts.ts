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
  uploaderId?: string; // present only for real uploaded shorts — used for Subscribe wiring
  uploaderAvatarUrl?: string; // present only for real uploaded shorts — creator's current avatar
}

// No more hardcoded dummy short — the Shorts page now fetches real
// uploaded shorts straight from DynamoDB (see app/shorts/page.tsx).
export const shorts: Short[] = [];
