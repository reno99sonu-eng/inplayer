import '../core/config/app_config.dart';
import 'video.dart';

/// One video in a channel's public video list, as returned inline by
/// GET /api/users/{username} (app/lib/getPublicProfile.ts's
/// `PublicProfileVideo`). Kept as its own light type rather than reusing
/// `Video` directly, since the profile endpoint's shape (thumbnailUrl,
/// numeric views, no uploader identity repeated per-row) differs slightly
/// from the feed/search shape `Video.fromJson` expects.
class ChannelVideo {
  final String videoId;
  final String title;
  final String? thumbnailUrl;
  final int views;
  final int likeCount;
  final int commentCount;
  final String? uploadedAt;
  final String contentType;
  final String? category;
  final String? muxPlaybackId;

  ChannelVideo({
    required this.videoId,
    required this.title,
    this.thumbnailUrl,
    this.views = 0,
    this.likeCount = 0,
    this.commentCount = 0,
    this.uploadedAt,
    this.contentType = 'video',
    this.category,
    this.muxPlaybackId,
  });

  static int _toInt(dynamic value) {
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  factory ChannelVideo.fromJson(Map<String, dynamic> json) {
    return ChannelVideo(
      videoId: json['videoId']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      thumbnailUrl: json['thumbnailUrl'] as String?,
      views: _toInt(json['views']),
      likeCount: _toInt(json['likeCount']),
      commentCount: _toInt(json['commentCount']),
      uploadedAt: json['uploadedAt'] as String?,
      contentType: (json['contentType'] as String?) ?? 'video',
      category: json['category'] as String?,
      muxPlaybackId: json['muxPlaybackId'] as String?,
    );
  }

  /// Adapts this row to the shared `Video` model so channel/watch screens
  /// can reuse `VideoCard` and the watch page instead of a second widget
  /// tree just for channel videos. The profile list doesn't repeat the
  /// uploader's own name/avatar/id on every row, so the channel screen
  /// supplies them from the parent `Channel`.
  Video toVideo({
    required String creatorName,
    String? creatorAvatar,
    String? uploaderUsername,
    String? uploaderId,
  }) {
    return Video.fromJson({
      'id': videoId,
      'videoId': videoId,
      'title': title,
      'creator': creatorName,
      'uploaderUsername': uploaderUsername,
      'avatar': creatorAvatar ?? '',
      'thumbnail': thumbnailUrl ?? '',
      'views': views,
      'uploadedAt': uploadedAt,
      'muxPlaybackId': muxPlaybackId,
      'uploaderId': uploaderId,
    });
  }
}

/// A creator's public channel. Backs three different real API shapes:
///  - GET /api/users/{username}   — full profile (bio, cover photo,
///    verified badge, subscriber/view counts, video list). Used by the
///    channel page itself.
///  - GET /api/subscriptions/list — the signed-in user's own subscription
///    rows (creatorId, username, name, avatarUrl, notifyEnabled only — no
///    bio/videos). Used by the "In-Family" / subscriptions list screen.
///  - GET /api/users/search?q=    — lightweight search hits (userId,
///    username, avatarUrl only).
/// All three are optional-field-safe here so one model can represent
/// whichever the caller actually has.
class Channel {
  final String creatorId;
  final String username;
  final String name;
  final String? avatarUrl;
  final String? coverPhotoUrl;
  final String? bio;
  final int? subscribers;
  final int? totalViews;
  final int? videoCount;
  final bool isSubscribed;
  final bool notifyEnabled;
  final bool isVerified;
  final bool isOwner;
  final bool gated;
  final String? joinedAt;
  final List<ChannelVideo> videos;

  Channel({
    required this.creatorId,
    required this.username,
    required this.name,
    this.avatarUrl,
    this.coverPhotoUrl,
    this.bio,
    this.subscribers,
    this.totalViews,
    this.videoCount,
    this.isSubscribed = false,
    this.notifyEnabled = true,
    this.isVerified = false,
    this.isOwner = false,
    this.gated = false,
    this.joinedAt,
    this.videos = const [],
  });

  static String? _resolveUrl(String? url) {
    if (url == null || url.isEmpty) return null;
    // Custom-uploaded avatars/covers can come back as inline base64 data
    // URIs, same as thumbnails elsewhere in the app — leave those as-is
    // for smartImageProvider() to decode, don't prefix them.
    if (url.startsWith('data:') ||
        url.startsWith('http://') ||
        url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/')) {
      return '${AppConfig.apiBaseUrl}$url';
    }
    return url;
  }

  static int? _toIntOrNull(dynamic value) {
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value);
    return null;
  }

  factory Channel.fromJson(Map<String, dynamic> json) {
    final videosJson = json['videos'] as List<dynamic>? ?? const [];
    final videos = videosJson
        .whereType<Map>()
        .map((v) => ChannelVideo.fromJson(Map<String, dynamic>.from(v)))
        .toList();

    final resolvedUsername =
        (json['username'] ?? json['uploaderUsername'] ?? '').toString();

    return Channel(
      creatorId: (json['userId'] ?? json['creatorId'] ?? json['uploaderId'] ?? '')
          .toString(),
      username: resolvedUsername,
      name: (json['name'] ?? json['uploaderName'] ?? resolvedUsername)
              .toString()
              .isNotEmpty
          ? (json['name'] ?? json['uploaderName'] ?? resolvedUsername).toString()
          : 'Unknown',
      avatarUrl: _resolveUrl(
          (json['avatarUrl'] ?? json['uploaderAvatarUrl']) as String?),
      coverPhotoUrl: _resolveUrl(json['coverPhotoUrl'] as String?),
      bio: (json['description'] ?? json['bio']) as String?,
      subscribers: _toIntOrNull(json['subscriberCount'] ?? json['subscribers']),
      totalViews: _toIntOrNull(json['totalViews']),
      videoCount: videos.isNotEmpty ? videos.length : _toIntOrNull(json['videoCount']),
      isSubscribed: json['isSubscribed'] == true,
      notifyEnabled: json['notifyEnabled'] != false,
      isVerified: json['isVerified'] == true,
      isOwner: json['isOwner'] == true,
      gated: json['gated'] == true,
      joinedAt: json['joinedAt'] as String?,
      videos: videos,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'creatorId': creatorId,
      'username': username,
      'name': name,
      'avatarUrl': avatarUrl,
      'coverPhotoUrl': coverPhotoUrl,
      'bio': bio,
      'subscribers': subscribers,
      'totalViews': totalViews,
      'videoCount': videoCount,
      'isSubscribed': isSubscribed,
      'notifyEnabled': notifyEnabled,
      'isVerified': isVerified,
      'isOwner': isOwner,
      'gated': gated,
      'joinedAt': joinedAt,
    };
  }

  Channel copyWith({
    String? creatorId,
    String? username,
    String? name,
    String? avatarUrl,
    String? coverPhotoUrl,
    String? bio,
    int? subscribers,
    int? totalViews,
    int? videoCount,
    bool? isSubscribed,
    bool? notifyEnabled,
    bool? isVerified,
    bool? isOwner,
    bool? gated,
    String? joinedAt,
    List<ChannelVideo>? videos,
  }) {
    return Channel(
      creatorId: creatorId ?? this.creatorId,
      username: username ?? this.username,
      name: name ?? this.name,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      coverPhotoUrl: coverPhotoUrl ?? this.coverPhotoUrl,
      bio: bio ?? this.bio,
      subscribers: subscribers ?? this.subscribers,
      totalViews: totalViews ?? this.totalViews,
      videoCount: videoCount ?? this.videoCount,
      isSubscribed: isSubscribed ?? this.isSubscribed,
      notifyEnabled: notifyEnabled ?? this.notifyEnabled,
      isVerified: isVerified ?? this.isVerified,
      isOwner: isOwner ?? this.isOwner,
      gated: gated ?? this.gated,
      joinedAt: joinedAt ?? this.joinedAt,
      videos: videos ?? this.videos,
    );
  }
}
