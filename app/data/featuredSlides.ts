// Real data only — see app/components/featuredHero/FeaturedHero.tsx,
// which fetches these from /api/featured-weekly (backed by
// app/lib/trendingStore). No example/dummy slides live in this file
// anymore.
export interface FeaturedSlide {
  videoId: string;
  title: string;
  uploaderName: string;
  uploaderUsername: string | null;
  uploaderAvatarUrl: string | null;
  thumbnailUrl: string | null;
  windowViews: number;
}
