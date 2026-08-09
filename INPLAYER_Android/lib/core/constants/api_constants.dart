import '../config/app_config.dart';

class ApiConstants {
  ApiConstants._();

  // Base URL comes from AppConfig.
  static String get baseUrl => AppConfig.apiBaseUrl;

  // Authentication
  static const String profileAvatar = '/api/profile/avatar';
  static const String profileSettings = '/api/profile/settings';
  static const String username = '/api/username';

  // Home
  static const String trending = '/api/trending';
  static const String featuredWeekly = '/api/featured-weekly';
  static const String navbarTheme = '/api/navbar-theme';

  // Videos
  static const String videos = '/api/videos';
  static const String videoDetail = '/api/videos';
  static const String videoPlaybackToken = '/api/videos';

  // Shorts
  static const String shorts = '/api/shorts';

  // Search
  static const String search = '/api/search';

  // Channels
  static const String creators = '/api/creators';
  static const String subscriptions = '/api/subscriptions';
  static const String subscriptionsList = '/api/subscriptions/list';
  static const String subscribe = '/api/subscriptions/subscribe';
  static const String unsubscribe = '/api/subscriptions/unsubscribe';

  // Messages
  static const String messages = '/api/messages';
  static const String conversations = '/api/messages/conversations';

  // Notifications
  static const String notifications = '/api/notifications';

  // Playlists
  static const String playlists = '/api/playlists';

  // Watch History
  static const String watchHistory = '/api/history';

  // Watchlist
  static const String watchlist = '/api/watchlist';

  // Likes
  static const String likes = '/api/likes';

  // Settings
  static const String platformSettings = '/api/platform-settings';

  // Admin
  static const String admin = '/api/admin';

  // Upload
  static const String uploadCreate = '/api/upload/create';
  static const String uploadComplete = '/api/upload/complete';
}
