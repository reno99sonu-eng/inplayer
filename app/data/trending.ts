// Real data only — see app/components/TrendingNow.tsx, which fetches these
// from /api/trending (backed by app/lib/trendingStore). The underlying
// ranking remains video-based; this is its creator-facing presentation.
export interface TrendingCreator {
  userId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  isVerified: boolean;
  windowViews: number;
}
