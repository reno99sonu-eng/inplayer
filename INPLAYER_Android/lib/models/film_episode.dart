import '../core/config/app_config.dart';

class FilmEpisode {
  final String videoId;
  final String seriesId;
  final int episodeNumber;
  final int seasonNumber;
  final String title;
  final String description;
  final String thumbnailUrl;
  final String? muxPlaybackId;
  final String? videoUrl;
  final double duration;
  final int views;
  final int likes;
  final String createdAt;

  FilmEpisode({
    required this.videoId,
    required this.seriesId,
    required this.episodeNumber,
    required this.seasonNumber,
    required this.title,
    required this.description,
    required this.thumbnailUrl,
    this.muxPlaybackId,
    this.videoUrl,
    required this.duration,
    required this.views,
    required this.likes,
    required this.createdAt,
  });

  factory FilmEpisode.fromJson(Map<String, dynamic> json) {
    return FilmEpisode(
      videoId: json['videoId'] ?? json['id'] ?? '',
      seriesId: json['seriesId'] ?? '',
      episodeNumber: (json['episodeNumber'] as num?)?.toInt() ?? 1,
      seasonNumber: (json['seasonNumber'] as num?)?.toInt() ?? 1,
      title: json['title'] ?? json['episodeTitle'] ?? 'Episode',
      description: json['description'] ?? '',
      thumbnailUrl: _resolveUrl(json['thumbnailUrl'] ?? json['poster'] ?? ''),
      muxPlaybackId: json['muxPlaybackId'] as String?,
      videoUrl: json['videoUrl'] as String?,
      duration: (json['duration'] as num?)?.toDouble() ?? 0.0,
      views: (json['views'] as num?)?.toInt() ?? (json['viewCount'] as num?)?.toInt() ?? 0,
      likes: (json['likes'] as num?)?.toInt() ?? (json['likeCount'] as num?)?.toInt() ?? 0,
      createdAt: json['createdAt'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'videoId': videoId,
      'seriesId': seriesId,
      'episodeNumber': episodeNumber,
      'seasonNumber': seasonNumber,
      'title': title,
      'description': description,
      'thumbnailUrl': thumbnailUrl,
      'muxPlaybackId': muxPlaybackId,
      'videoUrl': videoUrl,
      'duration': duration,
      'views': views,
      'likes': likes,
      'createdAt': createdAt,
    };
  }

  String? get streamUrl {
    if (muxPlaybackId != null && muxPlaybackId!.isNotEmpty) {
      return 'https://stream.mux.com/$muxPlaybackId.m3u8?max_resolution=1080p';
    }
    if (videoUrl != null && videoUrl!.isNotEmpty) {
      return _resolveUrl(videoUrl!);
    }
    return null;
  }

  static String _resolveUrl(String url) {
    if (url.isEmpty) return '';
    if (url.startsWith('/')) {
      return '${AppConfig.apiBaseUrl}$url';
    }
    return url;
  }
}
