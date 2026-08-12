/// GET /api/admin/dashboard-stats — real counts computed fresh from
/// DynamoDB on every load, no estimates.
class AdminDashboardStats {
  final int totalUsers;
  final int totalVideos;
  final int totalShorts;
  final int totalViews;
  final int processingCount;
  final int pendingReports;
  final bool reportsTableMissing;

  AdminDashboardStats({
    this.totalUsers = 0,
    this.totalVideos = 0,
    this.totalShorts = 0,
    this.totalViews = 0,
    this.processingCount = 0,
    this.pendingReports = 0,
    this.reportsTableMissing = false,
  });

  factory AdminDashboardStats.fromJson(Map<String, dynamic> json) {
    int toInt(dynamic v) => (v as num?)?.toInt() ?? 0;
    return AdminDashboardStats(
      totalUsers: toInt(json['totalUsers']),
      totalVideos: toInt(json['totalVideos']),
      totalShorts: toInt(json['totalShorts']),
      totalViews: toInt(json['totalViews']),
      processingCount: toInt(json['processingCount']),
      pendingReports: toInt(json['pendingReports']),
      reportsTableMissing: json['reportsTableMissing'] == true,
    );
  }
}
