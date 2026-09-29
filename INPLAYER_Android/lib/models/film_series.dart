import '../core/config/app_config.dart';

class FilmSeries {
  final String seriesId;
  final String creatorId;
  final String creatorName;
  final String creatorAvatarUrl;
  final String creatorHandle;
  final String title;
  final String description;
  final String genre;
  final List<String> categories;
  final String posterUrl;
  final String bannerUrl;
  final int episodeCount;
  final int totalViews;
  final int totalLikes;
  final int subscriberCount;
  final String status;
  final String visibility;
  final String language;
  final String createdAt;

  FilmSeries({
    required this.seriesId,
    required this.creatorId,
    required this.creatorName,
    required this.creatorAvatarUrl,
    required this.creatorHandle,
    required this.title,
    required this.description,
    required this.genre,
    required this.categories,
    required this.posterUrl,
    required this.bannerUrl,
    required this.episodeCount,
    required this.totalViews,
    required this.totalLikes,
    required this.subscriberCount,
    required this.status,
    required this.visibility,
    required this.language,
    required this.createdAt,
  });

  factory FilmSeries.fromJson(Map<String, dynamic> json) {
    return FilmSeries(
      seriesId: json['seriesId'] ?? json['id'] ?? '',
      creatorId: json['creatorId'] ?? '',
      creatorName: json['creatorName'] ?? 'Creator',
      creatorAvatarUrl: _resolveUrl(json['creatorAvatarUrl'] ?? json['creatorProfilePic'] ?? '/avatars/avatar.png'),
      creatorHandle: json['creatorHandle'] ?? 'creator',
      title: json['title'] ?? 'Untitled Series',
      description: json['description'] ?? '',
      genre: json['genre'] ?? 'Drama',
      categories: (json['categories'] as List<dynamic>?)?.map((e) => e.toString()).toList() ??
          (json['tags'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      posterUrl: _resolveUrl(json['posterUrl'] ?? json['thumbnailUrl'] ?? ''),
      bannerUrl: _resolveUrl(json['bannerUrl'] ?? json['posterUrl'] ?? ''),
      episodeCount: (json['episodeCount'] as num?)?.toInt() ?? 0,
      totalViews: (json['totalViews'] as num?)?.toInt() ?? (json['viewCount'] as num?)?.toInt() ?? 0,
      totalLikes: (json['totalLikes'] as num?)?.toInt() ?? 0,
      subscriberCount: (json['subscriberCount'] as num?)?.toInt() ?? 0,
      status: json['status'] ?? 'published',
      visibility: json['visibility'] ?? 'public',
      language: json['language'] ?? 'en',
      createdAt: json['createdAt'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'seriesId': seriesId,
      'creatorId': creatorId,
      'creatorName': creatorName,
      'creatorAvatarUrl': creatorAvatarUrl,
      'creatorHandle': creatorHandle,
      'title': title,
      'description': description,
      'genre': genre,
      'categories': categories,
      'posterUrl': posterUrl,
      'bannerUrl': bannerUrl,
      'episodeCount': episodeCount,
      'totalViews': totalViews,
      'totalLikes': totalLikes,
      'subscriberCount': subscriberCount,
      'status': status,
      'visibility': visibility,
      'language': language,
      'createdAt': createdAt,
    };
  }

  FilmSeries copyWith({
    String? seriesId,
    String? creatorId,
    String? creatorName,
    String? creatorAvatarUrl,
    String? creatorHandle,
    String? title,
    String? description,
    String? genre,
    List<String>? categories,
    String? posterUrl,
    String? bannerUrl,
    int? episodeCount,
    int? totalViews,
    int? totalLikes,
    int? subscriberCount,
    String? status,
    String? visibility,
    String? language,
    String? createdAt,
  }) {
    return FilmSeries(
      seriesId: seriesId ?? this.seriesId,
      creatorId: creatorId ?? this.creatorId,
      creatorName: creatorName ?? this.creatorName,
      creatorAvatarUrl: creatorAvatarUrl ?? this.creatorAvatarUrl,
      creatorHandle: creatorHandle ?? this.creatorHandle,
      title: title ?? this.title,
      description: description ?? this.description,
      genre: genre ?? this.genre,
      categories: categories ?? this.categories,
      posterUrl: posterUrl ?? this.posterUrl,
      bannerUrl: bannerUrl ?? this.bannerUrl,
      episodeCount: episodeCount ?? this.episodeCount,
      totalViews: totalViews ?? this.totalViews,
      totalLikes: totalLikes ?? this.totalLikes,
      subscriberCount: subscriberCount ?? this.subscriberCount,
      status: status ?? this.status,
      visibility: visibility ?? this.visibility,
      language: language ?? this.language,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  static String _resolveUrl(String url) {
    if (url.isEmpty) return '';
    if (url.startsWith('/')) {
      return '${AppConfig.apiBaseUrl}$url';
    }
    return url;
  }
}
