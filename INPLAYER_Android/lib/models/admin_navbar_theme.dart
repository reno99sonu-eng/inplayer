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

  /// GET /api/navbar-theme (the PUBLIC, unauthenticated endpoint every
  /// visitor's browser hits — app/api/navbar-theme/route.ts, mirrored by
  /// Navbar.tsx). Its response shape puts `active` at the TOP level and
  /// deliberately leaves it out of the nested `theme` object
  /// (`{active, theme: {occasionId, occasionName, title, imageUrl,
  /// updatedAt}}`), unlike the admin endpoint's `theme` object which
  /// includes its own `active` field. Reusing [fromJson] directly on just
  /// `json['theme']` would silently treat every inactive theme as active
  /// (`json['active'] != false` reads `true` when the key is simply
  /// absent) — this factory reads `active` from the right level instead.
  factory AdminNavbarTheme.fromPublicJson(Map<String, dynamic> json) {
    final theme = json['theme'];
    final themeMap = theme is Map
        ? Map<String, dynamic>.from(theme)
        : <String, dynamic>{};
    return AdminNavbarTheme(
      active: json['active'] == true,
      occasionId: themeMap['occasionId']?.toString() ?? 'custom',
      occasionName: themeMap['occasionName']?.toString() ?? 'Occasion Theme',
      title: themeMap['title']?.toString() ?? 'Occasion Theme',
      imageUrl: themeMap['imageUrl']?.toString() ?? '',
      updatedAt: themeMap['updatedAt'] as String?,
    );
  }
}
