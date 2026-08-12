/// One row from GET /api/admin/videos — the admin content browser, which
/// deliberately scans every status/visibility (unlike the public site).
/// Mirrors app/api/admin/videos/route.ts.
class AdminVideoRow {
  final String videoId;
  final String title;
  final String contentType; // 'video' | 'short'
  final String status;
  final String visibility;
  final int views;
  final String? uploaderId;
  final String? uploaderName;
  final String? thumbnailUrl;
  final String? uploadedAt;

  AdminVideoRow({
    required this.videoId,
    required this.title,
    required this.contentType,
    required this.status,
    required this.visibility,
    this.views = 0,
    this.uploaderId,
    this.uploaderName,
    this.thumbnailUrl,
    this.uploadedAt,
  });

  factory AdminVideoRow.fromJson(Map<String, dynamic> json) {
    return AdminVideoRow(
      videoId: json['videoId']?.toString() ?? '',
      title: json['title']?.toString() ?? '(untitled)',
      contentType: json['contentType']?.toString() ?? 'video',
      status: json['status']?.toString() ?? 'unknown',
      visibility: json['visibility']?.toString() ?? 'public',
      views: (json['views'] as num?)?.toInt() ?? 0,
      uploaderId: json['uploaderId'] as String?,
      uploaderName: json['uploaderName'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      uploadedAt: json['uploadedAt'] as String?,
    );
  }
}

class AdminVideosResult {
  final List<AdminVideoRow> videos;
  final String? nextCursor;
  AdminVideosResult({this.videos = const [], this.nextCursor});
}
