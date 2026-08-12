/// GET /api/admin/copyright — open copyright reports queue. Mirrors
/// app/api/admin/copyright/route.ts. `strikeThreshold` is the number of
/// strikes at which an uploader is auto-suspended (3 on the backend today).
class AdminCopyrightResult {
  final List<AdminCopyrightReport> items;
  final int strikeThreshold;
  final bool tableMissing;
  AdminCopyrightResult({this.items = const [], this.strikeThreshold = 3, this.tableMissing = false});

  factory AdminCopyrightResult.fromJson(Map<String, dynamic> json) {
    return AdminCopyrightResult(
      items: ((json['items'] as List?) ?? [])
          .whereType<Map>()
          .map((j) => AdminCopyrightReport.fromJson(Map<String, dynamic>.from(j)))
          .toList(),
      strikeThreshold: (json['strikeThreshold'] as num?)?.toInt() ?? 3,
      tableMissing: json['tableMissing'] == true,
    );
  }
}

class AdminCopyrightReport {
  final String reportId;
  final String videoId;
  final String title;
  final String? uploaderId;
  final String? uploaderUsername;
  final String? reporterId;
  final String? details;
  final String? createdAt;
  final int currentStrikes;

  AdminCopyrightReport({
    required this.reportId,
    required this.videoId,
    this.title = '(video not found)',
    this.uploaderId,
    this.uploaderUsername,
    this.reporterId,
    this.details,
    this.createdAt,
    this.currentStrikes = 0,
  });

  factory AdminCopyrightReport.fromJson(Map<String, dynamic> json) {
    return AdminCopyrightReport(
      reportId: json['reportId']?.toString() ?? '',
      videoId: json['videoId']?.toString() ?? '',
      title: json['title']?.toString() ?? '(video not found)',
      uploaderId: json['uploaderId'] as String?,
      uploaderUsername: json['uploaderUsername'] as String?,
      reporterId: json['reporterId'] as String?,
      details: json['details'] as String?,
      createdAt: json['createdAt'] as String?,
      currentStrikes: (json['currentStrikes'] as num?)?.toInt() ?? 0,
    );
  }
}
