import 'package:inplayer_android/core/config/app_config.dart';
import 'lyric_line.dart';

class Video {
  final String id;
  final String videoId;
  final String title;
  final String creator;
  final String? uploaderUsername;
  final String avatar;
  final String thumbnail;
  final String views;
  final String uploaded;
  final String duration;
  final bool verified;
  final String? muxPlaybackId;
  final String? description;
  final bool? membersOnly;
  final String? uploaderId;
  final String category;
  final String contentType;
  final bool isMusic;
  final List<String> covers;
  final int coverIntervalSeconds;
  final List<LyricLine> lyrics;
  final bool moderationHidden;
  final String? visibility;
  final String? copyrightRisk;
  final String? artist;
  /// 'everyone' | 'kids' | 'adult' — mirrors the website's videoAudience()
  /// fallback: the real `audience` field when present, else derived from
  /// `ageRestricted`. Lets the Android home feed build a real Kids row for
  /// the first time instead of just filtering nothing.
  final String audience;
  /// Music-only. One of MUSIC_GENRES on the website (app/lib/musicTrack.ts)
  /// — e.g. 'Pop', 'Hip-Hop', 'Devotional' — or null for a track uploaded
  /// before this field existed / a non-music row. Powers the Music hub's
  /// Genres grid. Deliberately separate from [category] ('Music' the
  /// topical content category vs. 'Pop' the actual genre — two different
  /// taxonomies that happen to both live on a music row).
  final String? genre;

  Video({
    required this.id,
    required this.videoId,
    required this.title,
    required this.creator,
    this.uploaderUsername,
    required this.avatar,
    required this.thumbnail,
    required this.views,
    required this.uploaded,
    required this.duration,
    this.verified = false,
    this.muxPlaybackId,
    this.description,
    this.membersOnly,
    this.uploaderId,
    this.category = 'Entertainment',
    this.contentType = 'video',
    this.isMusic = false,
    this.covers = const [],
    this.coverIntervalSeconds = 12,
    this.lyrics = const [],
    this.moderationHidden = false,
    this.visibility,
    this.copyrightRisk,
    this.artist,
    this.audience = 'everyone',
    this.genre,
  });

  static String _resolveUrl(String url) {
    if (url.startsWith('/')) {
      return '${AppConfig.apiBaseUrl}$url';
    }
    return url;
  }

  factory Video.fromJson(Map<String, dynamic> json) {
    final rawCategory = json['category']?.toString() ?? json['genre']?.toString() ?? 'Entertainment';
    final rawContentType = json['contentType']?.toString() ?? 'video';
    final isMusicTrack = rawContentType == 'music' || rawCategory.toLowerCase() == 'music' || json['isMusic'] == true;

    final rawCovers = json['covers'];
    List<String> parsedCovers = [];
    if (rawCovers is List) {
      parsedCovers = rawCovers.whereType<String>().map((u) => _resolveUrl(u)).toList();
    }
    if (parsedCovers.isEmpty && json['thumbnail'] != null) {
      parsedCovers = [_resolveUrl(json['thumbnail'].toString())];
    } else if (parsedCovers.isEmpty && json['thumbnailUrl'] != null) {
      parsedCovers = [_resolveUrl(json['thumbnailUrl'].toString())];
    }

    final rawLyrics = json['lyrics'];
    List<LyricLine> parsedLyrics = [];
    if (rawLyrics is List) {
      parsedLyrics = rawLyrics
          .whereType<Map>()
          .map((m) => LyricLine.fromJson(Map<String, dynamic>.from(m)))
          .toList();
    }

    // Mirrors the website's videoAudience(): a real 'everyone'/'kids'/'adult'
    // field takes precedence; otherwise fall back to ageRestricted.
    final rawAudience = json['audience']?.toString();
    final resolvedAudience = (rawAudience == 'everyone' || rawAudience == 'kids' || rawAudience == 'adult')
        ? rawAudience!
        : (json['ageRestricted'] == true ? 'adult' : 'everyone');

    final playbackId = json['muxPlaybackId']?.toString();
    final isShort = rawContentType == 'short';
    String rawThumb = json['thumbnail']?.toString() ?? json['thumbnailUrl']?.toString() ?? '';
    if (rawThumb.trim().isEmpty && playbackId != null && playbackId.isNotEmpty) {
      rawThumb = isShort
          ? 'https://image.mux.com/$playbackId/thumbnail.webp?width=640&height=1138&fit_mode=smartcrop&time=1'
          : 'https://image.mux.com/$playbackId/thumbnail.webp?width=640&height=360&fit_mode=smartcrop&time=1';
    }

    return Video(
      id: json['id']?.toString() ?? json['videoId']?.toString() ?? '',
      videoId: json['videoId']?.toString() ?? '',
      title: json['title'] ?? '',
      creator: json['creator'] ?? json['uploaderName'] ?? 'Unknown',
      uploaderUsername: json['uploaderUsername'],
      avatar: _resolveUrl(
          json['avatar'] ?? json['uploaderAvatarUrl'] ?? '/avatars/avatar.png'),
      thumbnail: _resolveUrl(rawThumb),
      views: _formatViews(json['views'] ?? 0),
      uploaded: _formatTimeAgo(json['uploadedAt'] ?? json['uploaded']),
      duration: _formatDuration(json['duration'] ?? 0),
      verified: json['verified'] ?? false,
      muxPlaybackId: json['muxPlaybackId'],
      description: json['description'],
      membersOnly: json['membersOnly'],
      uploaderId: json['uploaderId']?.toString(),
      category: rawCategory,
      contentType: rawContentType,
      isMusic: isMusicTrack,
      covers: parsedCovers,
      coverIntervalSeconds: (json['coverIntervalSeconds'] as num?)?.toInt() ?? 12,
      lyrics: parsedLyrics,
      moderationHidden: json['moderationHidden'] == true,
      visibility: json['visibility']?.toString(),
      copyrightRisk: json['copyrightRisk']?.toString(),
      artist: json['artist']?.toString() ?? json['creator']?.toString(),
      audience: resolvedAudience,
      genre: json['genre']?.toString().trim().isNotEmpty == true ? json['genre'].toString().trim() : null,
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

  static String _formatTimeAgo(dynamic timestamp) {
    if (timestamp == null) return 'Just now';

    DateTime dateTime;
    if (timestamp is String) {
      dateTime = DateTime.parse(timestamp);
    } else if (timestamp is DateTime) {
      dateTime = timestamp;
    } else {
      return 'Just now';
    }

    final diff = DateTime.now().difference(dateTime);
    final minutes = diff.inMinutes;

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return '${minutes}m ago';

    final hours = diff.inHours;
    if (hours < 24) return '${hours}h ago';

    final days = diff.inDays;
    return '${days}d ago';
  }

  static String _formatDuration(dynamic seconds) {
    if (seconds == null) return '0:00';

    int totalSeconds;
    if (seconds is int) {
      totalSeconds = seconds;
    } else if (seconds is double) {
      totalSeconds = seconds.round();
    } else if (seconds is String) {
      totalSeconds = int.tryParse(seconds) ?? 0;
    } else {
      return '0:00';
    }

    final mins = totalSeconds ~/ 60;
    final secs = totalSeconds % 60;
    return '$mins:${secs.toString().padLeft(2, '0')}';
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'videoId': videoId,
      'title': title,
      'creator': creator,
      'uploaderUsername': uploaderUsername,
      'avatar': avatar,
      'thumbnail': thumbnail,
      'views': views,
      'uploaded': uploaded,
      'duration': duration,
      'verified': verified,
      'muxPlaybackId': muxPlaybackId,
      'description': description,
      'membersOnly': membersOnly,
      'uploaderId': uploaderId,
      'category': category,
      'contentType': contentType,
      'isMusic': isMusic,
      'covers': covers,
      'coverIntervalSeconds': coverIntervalSeconds,
      'lyrics': lyrics.map((l) => l.toJson()).toList(),
      'moderationHidden': moderationHidden,
      'copyrightRisk': copyrightRisk,
      'artist': artist,
      'audience': audience,
      'genre': genre,
    };
  }
}
