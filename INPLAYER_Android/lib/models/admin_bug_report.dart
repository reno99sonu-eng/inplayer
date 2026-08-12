/// GET /api/admin/bug-reports — user-submitted "something's wrong" reports
/// from Settings > Report a Problem. Mirrors app/lib/bugReports.ts's
/// BugReport exactly.
class AdminBugReport {
  final String reportId;
  final String reporterId;
  final String? reporterUsername;
  final String reporterEmail;
  final String description;
  final String pageUrl;
  final String? screenshotDataUrl;
  final String status; // 'open' | 'in_progress' | 'resolved'
  final String? adminNotes;
  final String createdAt;
  final String updatedAt;

  AdminBugReport({
    required this.reportId,
    this.reporterId = '',
    this.reporterUsername,
    this.reporterEmail = '',
    this.description = '',
    this.pageUrl = '',
    this.screenshotDataUrl,
    this.status = 'open',
    this.adminNotes,
    this.createdAt = '',
    this.updatedAt = '',
  });

  factory AdminBugReport.fromJson(Map<String, dynamic> json) {
    return AdminBugReport(
      reportId: json['reportId']?.toString() ?? '',
      reporterId: json['reporterId']?.toString() ?? '',
      reporterUsername: json['reporterUsername'] as String?,
      reporterEmail: json['reporterEmail']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      pageUrl: json['pageUrl']?.toString() ?? '',
      screenshotDataUrl: json['screenshotDataUrl'] as String?,
      status: json['status']?.toString() ?? 'open',
      adminNotes: json['adminNotes'] as String?,
      createdAt: json['createdAt']?.toString() ?? '',
      updatedAt: json['updatedAt']?.toString() ?? '',
    );
  }
}
