import 'package:inplayer_android/core/config/app_config.dart';

class Short {
  final String id;
  final String videoId;
  final String title;
  final String creator;
  final String? uploaderUsername;
  final String? uploaderId;
  final String? uploaderAvatarUrl;
  final String poster;
  final String views;
  final String likes;
  final String comments;
  final String? description;
  final String? muxPlaybackId;
  final Soundtrack? soundtrack;

  Short({
    required this.id,
    required this.videoId,
    required this.title,
    required this.creator,
    this.uploaderUsername,
    this.uploaderId,
    this.uploaderAvatarUrl,
    required this.poster,
    required this.views,
    required this.likes,
    required this.comments,
    this.description,
    this.muxPlaybackId,
    this.soundtrack,
  });

  static String _resolveUrl(String url) {
    if (url.startsWith('/')) {
      return '${AppConfig.apiBaseUrl}$url';
    }
    return url;
  }

  factory Short.fromJson(Map<String, dynamic> json) {
    // On the raw video item (what `/api/videos` and DynamoDB actually
    // store), the soundtrack picked in ShortCreationTools lives nested
    // under `shortSettings.soundtrack`, not a top-level `soundtrack` key —
    // see app/shorts/page.tsx's own mapping on the website side.
    final shortSettings = json['shortSettings'];
    final soundtrackJson = shortSettings is Map
        ? shortSettings['soundtrack']
        : json['soundtrack'];

    return Short(
      id: json['id']?.toString() ?? json['videoId']?.toString() ?? '',
      videoId: json['videoId']?.toString() ?? '',
      title: json['title'] ?? '',
      creator: json['uploaderName'] ?? json['creator'] ?? 'Unknown',
      uploaderUsername: json['uploaderUsername'],
      uploaderId: json['uploaderId']?.toString(),
      uploaderAvatarUrl: json['uploaderAvatarUrl'] != null
          ? _resolveUrl(json['uploaderAvatarUrl'])
          : null,
      poster: _resolveUrl(json['poster'] ?? json['thumbnailUrl'] ?? ''),
      views: _formatViews(json['views'] ?? 0),
      // `likeCount`/`commentCount` are the real raw field names on a video
      // item; `likes`/`comments` are kept as a fallback in case a future
      // endpoint pre-formats them the way the website's server-rendered
      // Shorts page currently does.
      likes: _formatCount(json['likes'] ?? json['likeCount'] ?? 0),
      comments: _formatCount(json['comments'] ?? json['commentCount'] ?? 0),
      description: json['description'],
      muxPlaybackId: json['muxPlaybackId'],
      soundtrack: soundtrackJson is Map
          ? Soundtrack.fromJson(Map<String, dynamic>.from(soundtrackJson))
          : null,
    );
  }

  static String _formatViews(dynamic views) {
    if (views is int) {
      return '$views views';
    }
    if (views is String) {
      return views.contains('views') ? views : '$views views';
    }
    return '0 views';
  }

  static String _formatCount(dynamic count) {
    if (count is int) {
      return count.toString();
    }
    if (count is String) {
      return count;
    }
    return '0';
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'videoId': videoId,
      'title': title,
      'creator': creator,
      'uploaderUsername': uploaderUsername,
      'uploaderId': uploaderId,
      'uploaderAvatarUrl': uploaderAvatarUrl,
      'poster': poster,
      'views': views,
      'likes': likes,
      'comments': comments,
      'description': description,
      'muxPlaybackId': muxPlaybackId,
      'soundtrack': soundtrack?.toJson(),
    };
  }
}

class Soundtrack {
  final String id;
  final String title;
  final String artist;
  final String url;
  final int durationSeconds;
  final String source;
  final String? licenseUrl;

  Soundtrack({
    required this.id,
    required this.title,
    required this.artist,
    required this.url,
    required this.durationSeconds,
    required this.source,
    this.licenseUrl,
  });

  factory Soundtrack.fromJson(Map<String, dynamic> json) {
    return Soundtrack(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      artist: json['artist'] ?? '',
      url: json['url'] ?? '',
      durationSeconds: json['durationSeconds'] ?? 0,
      source: json['source'] ?? 'inplayer',
      licenseUrl: json['licenseUrl'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'artist': artist,
      'url': url,
      'durationSeconds': durationSeconds,
      'source': source,
      'licenseUrl': licenseUrl,
    };
  }
}