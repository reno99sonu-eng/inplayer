export interface Recommendation {
  id: number | string;
  title: string;
  creator: string;
  avatar: string;
  thumbnail: string;
  views: string;
  uploaded: string;
  duration: string;
  verified?: boolean;
  videoId?: string; // present only for real uploaded videos — used to link to /watch/[videoId]
  muxPlaybackId?: string; // present only for real uploaded videos — used for the hover preview
}

// No example/dummy recommendations — this feed is real-videos-only. Real
// DynamoDB-sourced videos are passed in via the `realVideos` prop (see
// RecommendationFeed.tsx), which still spreads this array in alongside
// them; kept as an empty array (rather than removing the merge entirely)
// so a future curated/editorial recommendation list can be added here
// without any component changes.
export const recommendations: Recommendation[] = [];