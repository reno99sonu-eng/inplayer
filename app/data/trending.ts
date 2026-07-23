// Real data only — see app/components/TrendingNow.tsx, which fetches
// these from /api/trending (backed by app/lib/trendingStore). No
// example/dummy trending items live in this file anymore.
export interface TrendingItem {
  videoId: string;
  title: string;
  creator: string;
  thumbnail: string | null;
  views: number; // views *today*, not the video's all-time count
}
