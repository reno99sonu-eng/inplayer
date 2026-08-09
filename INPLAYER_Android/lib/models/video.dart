import 'package:inplayer_android/core/config/app_config.dart';

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
  });

  static String _resolveUrl(String url) {
    if (url.startsWith('/')) {
      return '${AppConfig.apiBaseUrl}$url';
    }
    return url;
  }

  factory Video.fromJson(Map<String, dynamic> json) {
    return Video(
      id: json['id']?.toString() ?? json['videoId']?.toString() ?? '',
      videoId: json['videoId']?.toString() ?? '',
      title: json['title'] ?? '',
      creator: json['creator'] ?? json['uploaderName'] ?? 'Unknown',
      uploaderUsername: json['uploaderUsername'],
      avatar: _resolveUrl(
          json['avatar'] ?? json['uploaderAvatarUrl'] ?? '/avatars/avatar.png'),
      thumbnail: _resolveUrl(json['thumbnail'] ?? json['thumbnailUrl'] ?? ''),
      views: _formatViews(json['views'] ?? 0),
      uploaded: _formatTimeAgo(json['uploadedAt'] ?? json['uploaded']),
      duration: _formatDuration(json['duration'] ?? 0),
      verified: json['verified'] ?? false,
      muxPlaybackId: json['muxPlaybackId'],
      description: json['description'],
      membersOnly: json['membersOnly'],
      uploaderId: json['uploaderId']?.toString(),
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
    };
  }
}
