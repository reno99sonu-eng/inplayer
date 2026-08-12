/// GET/POST /api/admin/navbar-theme — mirrors
/// app/api/admin/navbar-theme/route.ts. A single active theme row (or
/// null if none is set).
class AdminNavbarTheme {
  final bool active;
  final String occasionId;
  final String occasionName;
  final String title;
  final String imageUrl;
  final String? updatedAt;

  AdminNavbarTheme({
    this.active = true,
    this.occasionId = 'custom',
    this.occasionName = 'Occasion Theme',
    this.title = 'Occasion Theme',
    required this.imageUrl,
    this.updatedAt,
  });

  factory AdminNavbarTheme.fromJson(Map<String, dynamic> json) {
    return AdminNavbarTheme(
      active: json['active'] != false,
      occasionId: json['occasionId']?.toString() ?? 'custom',
      occasionName: json['occasionName']?.toString() ?? 'Occasion Theme',
      title: json['title']?.toString() ?? 'Occasion Theme',
      imageUrl: json['imageUrl']?.toString() ?? '',
      updatedAt: json['updatedAt'] as String?,
    );
  }
}
