/// GET /api/admin/analytics — platform-wide totals plus a 7-day views
/// trend. Mirrors app/api/admin/analytics/route.ts exactly. `topToday`
/// (trending-today videos) is intentionally not modeled here — it's the
/// same data already surfaced on Home/Trending elsewhere in the app.
class AdminAnalytics {
  final int totalUsers;
  final int totalVideos;
  final int totalShorts;
  final int lifetimeViews;
  final int lifetimeShares;
  final int totalLikes;
  final int totalComments;
  final int totalSubscriptions;
  final List<AdminViewsTrendPoint> viewsTrend;

  AdminAnalytics({
    this.totalUsers = 0,
    this.totalVideos = 0,
    this.totalShorts = 0,
    this.lifetimeViews = 0,
    this.lifetimeShares = 0,
    this.totalLikes = 0,
    this.totalComments = 0,
    this.totalSubscriptions = 0,
    this.viewsTrend = const [],
  });

  factory AdminAnalytics.fromJson(Map<String, dynamic> json) {
    int toInt(dynamic v) => (v as num?)?.toInt() ?? 0;
    final totals = (json['totals'] as Map?) ?? {};
    return AdminAnalytics(
      totalUsers: toInt(totals['totalUsers']),
      totalVideos: toInt(totals['totalVideos']),
      totalShorts: toInt(totals['totalShorts']),
      lifetimeViews: toInt(totals['lifetimeViews']),
      lifetimeShares: toInt(totals['lifetimeShares']),
      totalLikes: toInt(totals['totalLikes']),
      totalComments: toInt(totals['totalComments']),
      totalSubscriptions: toInt(totals['totalSubscriptions']),
      viewsTrend: ((json['viewsTrend'] as List?) ?? [])
          .whereType<Map>()
          .map((j) => AdminViewsTrendPoint.fromJson(Map<String, dynamic>.from(j)))
          .toList(),
    );
  }
}

class AdminViewsTrendPoint {
  final String date;
  final int views;
  AdminViewsTrendPoint({required this.date, required this.views});

  factory AdminViewsTrendPoint.fromJson(Map<String, dynamic> json) {
    return AdminViewsTrendPoint(
      date: json['date']?.toString() ?? '',
      views: (json['views'] as num?)?.toInt() ?? 0,
    );
  }
}
