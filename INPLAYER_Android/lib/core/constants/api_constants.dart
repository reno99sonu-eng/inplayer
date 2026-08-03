class ApiConstants {
  ApiConstants._();

  // Base URL comes from AppConfig.
  static const String baseUrl = '';

  // Authentication
  static const String login = '/api/auth/login';
  static const String logout = '/api/auth/logout';
  static const String refreshSession = '/api/auth/refresh';

  // User
  static const String profile = '/api/profile';
  static const String account = '/api/account';

  // Home
  static const String homeFeed = '/api/home';
  static const String trending = '/api/trending';
  static const String featuredWeekly = '/api/featured-weekly';

  // Videos
  static const String videos = '/api/videos';
  static const String upload = '/api/upload';

  // Shorts
  static const String shorts = '/api/shorts';

  // Search
  static const String search = '/api/search';

  // Channels
  static const String creators = '/api/creators';
  static const String subscriptions = '/api/subscriptions';

  // Messages
  static const String messages = '/api/messages';

  // Notifications
  static const String notifications = '/api/notifications';

  // Playlists
  static const String playlists = '/api/playlists';

  // Watch History
  static const String watchHistory = '/api/watch-history';

  // Watchlist
  static const String watchlist = '/api/watchlist';

  // Settings
  static const String settings = '/api/settings';
}