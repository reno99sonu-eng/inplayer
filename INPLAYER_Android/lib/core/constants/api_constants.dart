import '../config/app_config.dart';

class ApiConstants {
  ApiConstants._();

  // Base URL comes from AppConfig.
  static String get baseUrl => AppConfig.apiBaseUrl;

  // Authentication
  static const String profileAvatar = '/api/profile/avatar';
  static const String profileCover = '/api/profile/cover';
  static const String profileSettings = '/api/profile/settings';
  static const String username = '/api/username';
  static const String bugReports = '/api/bug-reports';
  static const String sessions = '/api/sessions';

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

  // Live search-as-you-type suggestions (lightweight autocomplete —
  // videoId/title/thumbnail/contentType only, not full Video objects; see
  // video_service.dart's getSuggestions()). searchVideos() below still uses
  // '/api/videos' + a client-side filter for the full results grid — this
  // is a separate, additive endpoint just for the typeahead dropdown.
  static const String videoSuggest = '/api/videos/suggest';

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

  // Content access — the platform-wide 18+ / Kids-only audience control
  // (Settings > Content Access on the website, app/api/content-access/
  // route.ts). GET returns {mode, hasPasskey} and works signed-out too
  // (mode defaults to "family" — 18+ hidden — until a passkey unlocks
  // something else). POST branches on an `action` field:
  //   set_mode      { mode, passkey }              -> unlock a mode
  //   set_passkey   { passkey, currentPasskey? }    -> create/change the passkey
  //   reset_mode    {}                              -> back to "family", no passkey needed
  // The mode itself is carried by the server in an HttpOnly `inplayer-
  // audience` cookie set only after the passkey verifies — see
  // dio_client.dart, which sends that exact cookie name back on every
  // request from the value ContentAccessService caches locally.
  static const String contentAccess = '/api/content-access';

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

  // Premium / memberships
  //
  // GET premiumMe -> { premium, premiumUntil, maxResolution } — the signed-
  // in viewer's own real subscription status (app/hooks/usePremium.ts).
  // GET membershipStatus?creatorId= -> { isActive, status } — whether the
  // viewer has an active channel membership with one specific creator.
  // Neither endpoint moves money — the actual purchase/checkout still only
  // exists on the website (Razorpay), so both are read-only status calls;
  // see websiteOrigin below for the honest link-out to the real flow.
  static const String premiumMe = '/api/premium/me';
  static const String membershipStatus = '/api/memberships/status';

  // Creator monetization and payout KYC — real website routes that already
  // write to DynamoDB / AWS and are reviewed in the admin panel. These are
  // the actual contracts the app should use instead of placeholder status
  // cards.
  static const String creatorKyc = '/api/creator/kyc';
  static const String creatorPayoutStatus = '/api/creator/payout-status';
  static const String creatorMonetizeStatus = '/api/creator/monetize/status';
  static const String creatorMonetizeActivate =
      '/api/creator/monetize/activate';

  // Sponsorships — the sponsor checkout flow starts here and creates a real
  // Razorpay order via the website backend before opening Razorpay Checkout.
  static const String sponsorships = '/api/sponsorships';
  static const String sponsorshipCheckout = '/api/sponsorships/checkout';

  // Recommendation feedback (Interested / Not Interested) and content
  // reports — the watch-page and video-card "⋮ More options" menu.
  static const String videoFeedback = '/api/video-feedback';
  static const String reports = '/api/reports';

  // Ads
  //
  // GET ads?placement= -> { source: 'off'|'house'|'adsense', creative,
  // creatives }. 'house' creatives (Reno's own promos) render and track
  // natively; 'adsense' is deliberately not built here — it needs a native
  // Google Mobile Ads SDK this Android-folder-only pass can't add — so an
  // 'adsense' response is treated the same as 'off'.
  // POST ads { adId, event: 'impression'|'click' } — fire-and-forget.
  static const String ads = '/api/ads';

  // The real website — used only for the small set of actions this app
  // honestly can't complete natively yet (Razorpay checkout for Premium/
  // memberships, InJoy games, Sponsorships): the app shows real, live
  // status fetched from the API above, and only the actual money-moving or
  // unbuildable step opens this URL instead of faking it.
  static const String websiteOrigin = 'https://inplayer.in';
}
