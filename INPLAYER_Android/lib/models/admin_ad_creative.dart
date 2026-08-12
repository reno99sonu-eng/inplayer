/// Ad creative shapes for the Advertising section. `AdminAdCreative` covers
/// the three static placements (homepage/watch/weekly_featured, GET/POST
/// /api/admin/ads) and `AdminMidrollAdCreative` covers the separate
/// mid-roll table (GET/POST /api/admin/midroll-ads) — kept as two classes
/// since the backend genuinely models them as two separate tables with
/// slightly different fields (placement vs. skips).
class AdminAdCreative {
  final String adId;
  final String placement; // 'homepage' | 'watch' | 'weekly_featured'
  final String imageUrl;
  final String? imageUrlDesktop;
  final String linkUrl;
  final String title;
  final bool active;
  final String createdAt;
  final int impressions;
  final int clicks;

  AdminAdCreative({
    required this.adId,
    required this.placement,
    required this.imageUrl,
    this.imageUrlDesktop,
    required this.linkUrl,
    required this.title,
    this.active = true,
    this.createdAt = '',
    this.impressions = 0,
    this.clicks = 0,
  });

  factory AdminAdCreative.fromJson(Map<String, dynamic> json) {
    return AdminAdCreative(
      adId: json['adId']?.toString() ?? '',
      placement: json['placement']?.toString() ?? 'homepage',
      imageUrl: json['imageUrl']?.toString() ?? '',
      imageUrlDesktop: json['imageUrlDesktop'] as String?,
      linkUrl: json['linkUrl']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      active: json['active'] != false,
      createdAt: json['createdAt']?.toString() ?? '',
      impressions: (json['impressions'] as num?)?.toInt() ?? 0,
      clicks: (json['clicks'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminMidrollAdCreative {
  final String adId;
  final String imageUrl;
  final String linkUrl;
  final String title;
  final bool active;
  final String createdAt;
  final int impressions;
  final int clicks;
  final int skips;

  AdminMidrollAdCreative({
    required this.adId,
    required this.imageUrl,
    required this.linkUrl,
    required this.title,
    this.active = true,
    this.createdAt = '',
    this.impressions = 0,
    this.clicks = 0,
    this.skips = 0,
  });

  factory AdminMidrollAdCreative.fromJson(Map<String, dynamic> json) {
    return AdminMidrollAdCreative(
      adId: json['adId']?.toString() ?? '',
      imageUrl: json['imageUrl']?.toString() ?? '',
      linkUrl: json['linkUrl']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      active: json['active'] != false,
      createdAt: json['createdAt']?.toString() ?? '',
      impressions: (json['impressions'] as num?)?.toInt() ?? 0,
      clicks: (json['clicks'] as num?)?.toInt() ?? 0,
      skips: (json['skips'] as num?)?.toInt() ?? 0,
    );
  }

  /// Whether this row is a Mux video-upload creative (`status: "processing"`,
  /// empty imageUrl) rather than a data-URI image — the app only builds
  /// image-based midroll ads, so these should render as unsupported here.
  bool get isVideoUpload => imageUrl.isEmpty;
}
