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
  uploaderAvatarUrl?: string; // present only for real uploaded shorts
  description?: string; // present only for real uploaded shorts
}

export const shorts: Short[] = [
  {
    id: 5,
    title: "Billionaire Ka Vanvas: First Look",
    creator: "InPlay",
    poster: "/shorts/5.jpg",
    views: "3.7M views",
    likes: "201K",
    comments: "4.1K",
  },
];