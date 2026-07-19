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
}

export const recommendations: Recommendation[] = [
  {
    id: 26,
    title: "Bhramit",
    creator: "InPlay",
    avatar: "/recommendations/avatars/26.jpg",
    thumbnail: "/recommendations/thumbnails/26.jpg",
    views: "890K views",
    uploaded: "2 days ago",
    duration: "2:14",
    verified: true,
  },
];