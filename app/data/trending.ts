export interface TrendingItem {
  id: number;
  title: string;
  creator: string;
  thumbnail: string;
  views: string;
  duration: string;
}

export const trending: TrendingItem[] = [
  {
    id: 1,
    title: "The Last Kingdom: Official Trailer",
    creator: "InPlayer Originals",
    thumbnail: "/trending/1.jpg",
    views: "18.4M views",
    duration: "2:08",
  },
  {
    id: 2,
    title: "The Billionaire's Secret",
    creator: "InPlayer Originals",
    thumbnail: "/trending/2.jpg",
    views: "11.7M views",
    duration: "1:56",
  },
  {
    id: 3,
    title: "Love Beyond Time",
    creator: "Romance Hub",
    thumbnail: "/trending/3.jpg",
    views: "8.9M views",
    duration: "2:21",
  },
  {
    id: 4,
    title: "Black Signal",
    creator: "CrimeVerse",
    thumbnail: "/trending/4.jpg",
    views: "15.6M views",
    duration: "2:43",
  },
  {
    id: 5,
    title: "Into The Himalayas",
    creator: "Travel Explorer",
    thumbnail: "/trending/5.jpg",
    views: "7.4M views",
    duration: "18:12",
  },
  {
    id: 6,
    title: "Cyber Hunt",
    creator: "Future Studios",
    thumbnail: "/trending/6.jpg",
    views: "13.2M views",
    duration: "2:34",
  },
  {
    id: 7,
    title: "Hidden Oceans",
    creator: "Nature Vision",
    thumbnail: "/trending/7.jpg",
    views: "9.5M views",
    duration: "21:45",
  },
  {
    id: 8,
    title: "Stadium of Dreams",
    creator: "Sports Live",
    thumbnail: "/trending/8.jpg",
    views: "10.8M views",
    duration: "12:58",
  },
  {
    id: 9,
    title: "Street Food Diaries: Kolkata",
    creator: "Food Trails",
    thumbnail: "/trending/9.jpg",
    views: "6.9M views",
    duration: "15:42",
  },
  {
    id: 10,
    title: "Lost City Expedition",
    creator: "Adventure Now",
    thumbnail: "/trending/10.jpg",
    views: "14.1M views",
    duration: "19:11",
  },
];