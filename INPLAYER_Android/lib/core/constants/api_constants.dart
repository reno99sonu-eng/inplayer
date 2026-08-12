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
  //
  // `/api/creators` is the paginated "browse everyone" list (cursor-only,
  // no per-username or query filter — passing `username`/`q` to it is a
  // no-op that just returns page 1 of everybody). Looking up ONE creator's
  // full public profile (bio, cover photo, verified badge, subscriber /
  // view counts, their video list) is `users` below:
  // GET '$users/{username}'. Searching creators by handle-as-you-type is
  // GET '$users/search?q={query}'.
  static const String creators = '/api/creators';
  static const String users = '/api/users';
  static const String subscriptionsList = '/api/subscriptions/list';

  // Subscribing/unsubscribing is NOT a separate REST path — there is no
  // `/api/subscriptions/subscribe` or `/api/subscriptions/unsubscribe` on
  // the backend (calling those 404s). It's a single endpoint that branches
  // on an `action` field in the POST body:
  //   POST subscriptions  { creatorId, action: 'subscribe' | 'unsubscribe' | 'notify', notifyEnabled? }
  //   GET  subscriptions?creatorId=X -> { subscriberCount, isSubscribed, notifyEnabled }
  static const String subscriptions = '/api/subscriptions';

  // Messages
  //
  // One endpoint per concern, all nested under `messages`. There is no
  // separate `/api/messages/conversations` route (confirmed against the
  // website's own app/api/messages directory) — GET messages IS the
  // conversation list, split into `conversations`/`requests` in its own
  // response body:
  //   GET  messages                       -> { conversations, requests }
  //   POST messages { otherUserId, text }  -> starts a chat OR sends the
  //                                           next message in one
  //   GET  messages/{id}                   -> one conversation + presence
  //   PATCH messages/{id} { action }        -> accept/decline/block/mute
  //   GET  messages/{id}/messages          -> message history
  //   PATCH messages/{id}/messages          -> delete a message
  //   POST messages/{id}/typing            -> typing indicator ping
  static const String messages = '/api/messages';

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
  static const String myLikes = '/api/likes/my-likes';

  // Comments
  static const String comments = '/api/comments';

  // My Videos (signed-in user's own uploads — any status/visibility)
  static const String myVideos = '/api/my-videos';

  // Settings
  static const String platformSettings = '/api/platform-settings';

  // Account
  static const String accountDelete = '/api/account/delete';

  // Admin
  static const String admin = '/api/admin';

  // Hammart (marketplace)
  static const String hammartProducts = '/api/hammart/products';
  static const String hammartCart = '/api/hammart/cart';
  static const String hammartWishlist = '/api/hammart/wishlist';

  // Live streaming
  //
  // Only these two routes are real REST endpoints (app/api/live/ivs-create,
  // app/api/live/end). The website's own live *viewer* page
  // (app/live/[videoId]/page.tsx) is a server component that reads
  // straight from DynamoDB — there is no GET /api/live/{videoId} or any
  // "list currently-live streams" REST endpoint for a client to call. That
  // means this app can run the real broadcaster flow (create a channel,
  // get real ingest credentials, end the stream) but can't yet build a
  // "watch someone else's live stream" screen without a new backend route,
  // which is out of scope per the Android-folder-only constraint. See the
  // project doc for the full explanation.
  static const String liveCreate = '/api/live/ivs-create';
  static const String liveEnd = '/api/live/end';

  // Upload
  //
  // There is no separate "complete" step — POST uploadCreate returns a
  // one-time Mux direct-upload URL; the client PUTs the raw file straight
  // to that URL, and Mux's webhook (self-healed by a GET to
  // `$videos/{videoId}/status`, which upload_service.dart polls) fills in
  // the rest once transcoding finishes. Confirmed against the website's
  // own app/api/upload/create/route.ts and app/upload/page.tsx — there is
  // no `/api/upload/complete` route on the backend.
  static const String uploadCreate = '/api/upload/create';
}
