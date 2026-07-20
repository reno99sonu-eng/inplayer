export interface Short {
  id: number | string;
  title: string;
  creator: string;
  poster: string;
  views: string;
  likes: string;
  comments: string;
  videoId?: string;
  muxPlaybackId?: string;
  uploaderId?: string;
  uploaderAvatarUrl?: string;
  description?: string;
}

export const shorts: Short[] = [];