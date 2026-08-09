import 'package:inplayer_android/core/config/app_config.dart';

class TrendingCreator {
  final String userId;
  final String username;
  final String name;
  final String avatarUrl;
  final bool isVerified;
  final int windowViews;

  TrendingCreator({
    required this.userId,
    required this.username,
    required this.name,
    required this.avatarUrl,
    required this.isVerified,
    required this.windowViews,
  });

  factory TrendingCreator.fromJson(Map<String, dynamic> json) {
    return TrendingCreator(
      userId: json['userId'] ?? '',
      username: json['username'] ?? '',
      name: json['name'] ?? '',
      avatarUrl: _resolveUrl(json['avatarUrl'] ?? '/avatars/avatar.png'),
      isVerified: json['isVerified'] ?? false,
      windowViews: json['windowViews'] ?? 0,
    );
  }

  static String _resolveUrl(String url) {
    if (url.startsWith('/')) {
      return '${AppConfig.apiBaseUrl}$url';
    }
    return url;
  }
}
