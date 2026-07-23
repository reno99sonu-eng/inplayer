// Real data only — see app/components/featuredHero/FeaturedHero.tsx,
// which fetches these from /api/featured-weekly (backed by
// app/lib/trendingStore). No example/dummy slides live in this file
// anymore.
export interface FeaturedSlide {
  videoId: string;
  title: string;
  creator: string;
  thumbnail: string | null;
  views: number; // views over the trailing 7 days, not the video's all-time count
}
