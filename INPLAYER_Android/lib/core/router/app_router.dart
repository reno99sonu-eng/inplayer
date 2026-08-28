import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';
import '../../providers/auth_provider.dart';
import '../../features/auth/presentation/pages/sign_in_page.dart';
import '../../features/auth/presentation/pages/sign_up_page.dart';
import '../../features/auth/presentation/pages/verify_email_page.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/shorts/presentation/pages/shorts_page.dart';
import '../../features/watch/presentation/pages/watch_page.dart';
import '../../features/search/presentation/pages/search_page.dart';
import '../../features/subscriptions/presentation/pages/subscriptions_page.dart';
import '../../features/profile/presentation/pages/profile_page.dart';
import '../../features/channel/presentation/pages/channel_page.dart';
import '../../features/upload/presentation/pages/upload_page.dart';
import '../../features/settings/presentation/pages/settings_page.dart';
import '../../features/messages/presentation/pages/messages_page.dart';
import '../../features/messages/presentation/pages/new_message_page.dart';
import '../../features/messages/presentation/pages/conversation_page.dart';
import '../../features/channel/presentation/pages/my_channel_studio_page.dart';
import '../../features/shop/presentation/pages/shop_page.dart';
import '../../features/shop/presentation/pages/product_detail_page.dart';
import '../../features/shop/presentation/pages/cart_page.dart';
import '../../features/shop/presentation/pages/wishlist_page.dart' as hammart_wishlist;
import '../../features/notifications/presentation/pages/notifications_page.dart';
import '../../features/profile/presentation/pages/video_list_page.dart';
import '../../features/profile/presentation/pages/watch_history_page.dart';
import '../../features/profile/presentation/pages/watchlist_page.dart';
import '../../features/profile/presentation/pages/playlists_page.dart';
import '../../features/profile/presentation/pages/playlist_detail_page.dart';
import '../../features/settings/presentation/pages/edit_profile_page.dart';
import '../../features/settings/presentation/pages/privacy_settings_page.dart';
import '../../features/settings/presentation/pages/change_password_page.dart';
import '../../features/settings/presentation/pages/change_email_page.dart';
import '../../features/settings/presentation/pages/playback_settings_page.dart';
import '../../features/admin/presentation/pages/admin_page.dart';
import '../../features/live/presentation/pages/go_live_page.dart';
import '../../features/downloads/presentation/pages/downloads_page.dart';
import '../../features/settings/presentation/pages/content_access_page.dart';
import '../../features/settings/presentation/pages/plans_purchases_page.dart';
import '../../features/settings/presentation/pages/analytics_page.dart';
import '../../features/settings/presentation/pages/storage_page.dart';
import '../../features/discover/presentation/pages/discover_creators_page.dart';
import '../../features/home/presentation/pages/category_videos_page.dart';
import '../../features/music/presentation/pages/genre_page.dart';
import '../../features/music/presentation/pages/liked_music_page.dart';
import '../../features/settings/presentation/pages/contact_us_page.dart';
import '../../features/settings/presentation/pages/report_problem_page.dart';
import '../../features/settings/presentation/pages/blocked_users_page.dart';
import '../../features/settings/presentation/pages/app_legal_page.dart';
import '../../services/video_service.dart';

// Bridges authStateProvider's changes into a plain Listenable go_router can
// react to via `refreshListenable`, WITHOUT the whole GoRouter being torn
// down and rebuilt on every auth transition. Before this, routerProvider
// used `ref.watch(authStateProvider)` directly inside its own builder —
// since a Riverpod Provider re-runs its entire builder whenever a watched
// value changes, that meant a brand-new GoRouter() (new Navigator, new
// route/back-stack, the works) was constructed from scratch every single
// time auth state changed — which happens at least once on every cold
// start (AuthStateInitial -> AuthStateAuthenticated/Unauthenticated, once
// AuthNotifier._init() resolves), and again on every sign-in/out. That's
// exactly the kind of full widget-subtree churn that can make an app feel
// slow/janky and can visibly disrupt whatever's on screen at the moment it
// happens — including the splash overlay, which sits as a sibling of the
// Router's own child in main.dart's MaterialApp.router builder.
class _AuthRefreshNotifier extends ChangeNotifier {
  _AuthRefreshNotifier(Ref ref) {
    ref.listen<AuthState>(authStateProvider, (previous, next) => notifyListeners());
  }
}

final _authRefreshNotifierProvider = Provider<_AuthRefreshNotifier>((ref) {
  final notifier = _AuthRefreshNotifier(ref);
  ref.onDispose(notifier.dispose);
  return notifier;
});

final routerProvider = Provider<GoRouter>((ref) {
  // Watching this (not authStateProvider itself) is what keeps GoRouter
  // stable: _authRefreshNotifierProvider's own body has no watched
  // dependencies, so it's built exactly once and never invalidates —
  // routerProvider's builder only ever runs once per app lifetime now.
  final refreshNotifier = ref.watch(_authRefreshNotifierProvider);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refreshNotifier,
    redirect: (context, state) {
      // Read (not watch) — this closure re-runs on every navigation AND
      // every time refreshListenable fires, so it always sees the current
      // auth state without needing routerProvider itself to rebuild.
      final authState = ref.read(authStateProvider);
      final isAuthenticated = authState is AuthStateAuthenticated;
      final isVerificationPage = state.matchedLocation == '/verify';
      final isAuthPage =
          state.matchedLocation == '/signin' ||
          state.matchedLocation == '/signup';

      // If needs verification, redirect to verify page
      if (authState is AuthStateNeedsVerification && !isVerificationPage) {
        return '/verify?email=${authState.email}';
      }

      // If authenticated and trying to access auth pages, go to home
      if (isAuthenticated && isAuthPage) {
        return '/';
      }

      // Explicit protected routes that strictly require authentication
      const protectedPrefixes = [
        '/upload',
        '/creator-studio',
        '/settings',
        '/messages',
        '/cart',
        '/admin',
        '/live',
      ];
      final isProtected = protectedPrefixes.any((prefix) => state.matchedLocation.startsWith(prefix));

      // If unauthenticated and accessing a protected action, redirect to signin
      if (!isAuthenticated && isProtected) {
        return '/signin';
      }

      return null;
    },
    routes: [
      // Auth Routes
      GoRoute(
        path: '/signin',
        name: 'signin',
        builder: (context, state) => const SignInPage(),
      ),
      GoRoute(
        path: '/signup',
        name: 'signup',
        builder: (context, state) => const SignUpPage(),
      ),
      GoRoute(
        path: '/verify',
        name: 'verify',
        builder: (context, state) {
          final email = state.uri.queryParameters['email'] ?? '';
          return VerifyEmailPage(email: email);
        },
      ),

      // Main App Routes
      GoRoute(
        path: '/',
        name: 'home',
        builder: (context, state) => const HomePage(),
      ),
      GoRoute(
        path: '/shorts',
        name: 'shorts',
        builder: (context, state) => const ShortsPage(),
      ),
      // Deep-link target for shared Raftaar (Shorts) videos — lands on the
      // scrolling Shorts feed positioned at this video, instead of the raw
      // watch page. Share links now point here (see short_player_widget's
      // _shareShort); the plain /watch/:videoId route is left untouched so
      // the player's existing "Full page" button keeps opening shorts there.
      GoRoute(
        path: '/shorts/:videoId',
        name: 'shorts-video',
        builder: (context, state) {
          final videoId = state.pathParameters['videoId'] ?? '';
          return ShortsPage(startVideoId: videoId);
        },
      ),
      GoRoute(
        path: '/watch/:videoId',
        name: 'watch',
        builder: (context, state) {
          final videoId = state.pathParameters['videoId'] ?? '';
          // Set only when re-expanding the draggable mini player (see
          // VideoMiniPlayerOverlay._restore) — every other existing caller
          // of this route never passes `extra`, so this is null for them
          // exactly as before and WatchPage falls back to its normal
          // fresh-controller path unchanged.
          final adoptController = state.extra is VideoPlayerController ? state.extra as VideoPlayerController : null;
          return WatchPage(videoId: videoId, adoptController: adoptController);
        },
      ),
      GoRoute(
        path: '/search',
        name: 'search',
        builder: (context, state) => const SearchPage(),
      ),
      GoRoute(
        path: '/subscriptions',
        name: 'subscriptions',
        builder: (context, state) => const SubscriptionsPage(),
      ),
      GoRoute(
        path: '/profile',
        name: 'profile',
        builder: (context, state) => const ProfilePage(),
      ),
      GoRoute(
        path: '/channel/:username',
        name: 'channel',
        builder: (context, state) {
          final username = state.pathParameters['username'] ?? '';
          return ChannelPage(username: username);
        },
      ),
      GoRoute(
        path: '/upload',
        name: 'upload',
        builder: (context, state) => const UploadPage(),
      ),
      GoRoute(
        path: '/settings',
        name: 'settings',
        builder: (context, state) => const SettingsPage(),
      ),
      GoRoute(
        path: '/settings/edit-profile',
        name: 'edit-profile',
        builder: (context, state) => const EditProfilePage(),
      ),
      GoRoute(
        path: '/settings/privacy',
        name: 'privacy-settings',
        builder: (context, state) => const PrivacySettingsPage(),
      ),
      GoRoute(
        path: '/settings/change-password',
        name: 'change-password',
        builder: (context, state) => const ChangePasswordPage(),
      ),
      GoRoute(
        path: '/settings/change-email',
        name: 'change-email',
        builder: (context, state) => const ChangeEmailPage(),
      ),
      GoRoute(
        path: '/settings/playback',
        name: 'playback-settings',
        builder: (context, state) => const PlaybackSettingsPage(),
      ),
      GoRoute(
        path: '/settings/content-access',
        name: 'content-access',
        builder: (context, state) => const ContentAccessPage(),
      ),
      GoRoute(
        path: '/settings/plans',
        name: 'plans-purchases',
        builder: (context, state) => const PlansPurchasesPage(),
      ),
      GoRoute(
        path: '/settings/analytics',
        name: 'settings-analytics',
        builder: (context, state) => const AnalyticsPage(),
      ),
      GoRoute(
        path: '/settings/storage',
        name: 'settings-storage',
        builder: (context, state) => const StoragePage(),
      ),
      GoRoute(
        path: '/settings/report-problem',
        name: 'report-problem',
        builder: (context, state) => const ReportProblemPage(),
      ),
      GoRoute(
        path: '/settings/blocked-users',
        name: 'blocked-users',
        builder: (context, state) => const BlockedUsersPage(),
      ),
      GoRoute(
        path: '/settings/terms',
        name: 'terms-of-service',
        builder: (context, state) => const AppLegalPage(
          title: 'Terms of Service',
          content: 'Welcome to InPlayer. By accessing or using our website, services, and mobile applications, you agree to be bound by these Terms of Service.\n\n1. Acceptance of Terms: By registering for, accessing, or using the InPlayer platform, you confirm that you are at least 13 years of age and agree to comply with these terms.\n\n2. User Accounts: You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.\n\n3. Content Guidelines: You retain ownership of content you upload, but grant InPlayer a worldwide license to host, display, and distribute it.\n\n4. Monetization & Payouts: Eligible creators may receive revenue share subject to community guidelines and KYC verification.',
        ),
      ),
      GoRoute(
        path: '/settings/privacy-policy',
        name: 'privacy-policy',
        builder: (context, state) => const AppLegalPage(
          title: 'Privacy Policy',
          content: 'At InPlayer, your privacy and data security are our top priorities.\n\n1. Information We Collect: We collect information you provide directly (such as name, email, profile photo) and data generated when you interact with content (watch history, likes, subscriptions).\n\n2. How We Use Information: We use your data to personalize recommendations, process creator payouts, enforce safety features (such as on-device age classification and biometric lock), and prevent abuse.\n\n3. Data Protection: All data is encrypted in transit and at rest. We never sell your personal information to third parties.\n\n4. Your Rights: You can update your profile, export your watch history, or delete your account at any time from the Settings menu.',
        ),
      ),
      GoRoute(
        path: '/settings/vendor-terms',
        name: 'vendor-terms',
        builder: (context, state) => const AppLegalPage(
          title: 'HamMart Vendor Terms',
          content: 'HamMart is InPlayer\'s integrated creator and merchandise marketplace.\n\n1. Eligibility: Verified creators and authorized vendors can list merchandise and digital products for purchase by the community.\n\n2. Fulfillment & Quality: Vendors are solely responsible for product fulfillment, accurate item descriptions, and handling customer inquiries.\n\n3. Revenue & Fees: Transactions are processed securely, with platform commissions and vendor payouts calculated and disbursed according to the vendor agreement.',
        ),
      ),
      GoRoute(
        path: '/settings/help',
        name: 'help-center',
        builder: (context, state) => const AppLegalPage(
          title: 'Help Center & FAQ',
          content: 'Frequently Asked Questions & Support:\n\nQ: How do I upload a video or Raftaar short?\nA: Tap the "+" button in the top bar or navigation drawer to open the Upload screen.\n\nQ: How do I enable Fingerprint / Passkey lock?\nA: Go to Settings -> Account & Privacy -> Privacy, Passkeys & Active Sessions, and switch on Passkey & Biometric App Lock.\n\nQ: How do I turn on Kids Mode?\nA: Open the hamburger menu and switch on Kids only. A passkey is needed only when turning 18+ content on.\n\nQ: How do I contact the InPlayer team?\nA: Tap "Contact Support" in Settings or email support@inplayer.in.',
        ),
      ),
      GoRoute(
        path: '/creators',
        name: 'creators',
        builder: (context, state) => const DiscoverCreatorsPage(),
      ),
      GoRoute(
        path: '/category/:category',
        name: 'category-videos',
        builder: (context, state) {
          final category = Uri.decodeComponent(state.pathParameters['category'] ?? '');
          return CategoryVideosPage(category: category);
        },
      ),
      GoRoute(
        path: '/messages',
        name: 'messages',
        builder: (context, state) => const MessagesPage(),
      ),
      // Literal routes declared before the dynamic ':conversationId'
      // route below so they win the match instead of being swallowed as
      // a conversationId of "new"/"compose".
      GoRoute(
        path: '/messages/new',
        name: 'new-message',
        builder: (context, state) => const NewMessagePage(),
      ),
      GoRoute(
        path: '/messages/compose',
        name: 'message-compose',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return ConversationPage(
            otherUserId: extra?['otherUserId'] as String? ?? '',
            otherUsername: extra?['otherUsername'] as String?,
            otherAvatarUrl: extra?['otherAvatarUrl'] as String?,
          );
        },
      ),
      GoRoute(
        path: '/messages/:conversationId',
        name: 'conversation',
        builder: (context, state) {
          final conversationId = state.pathParameters['conversationId'] ?? '';
          final extra = state.extra as Map<String, dynamic>?;
          return ConversationPage(
            conversationId: conversationId,
            otherUserId: extra?['otherUserId'] as String? ?? '',
            otherUsername: extra?['otherUsername'] as String?,
            otherAvatarUrl: extra?['otherAvatarUrl'] as String?,
          );
        },
      ),
      GoRoute(
        path: '/creator-studio',
        name: 'creator-studio',
        builder: (context, state) => const MyChannelStudioPage(),
      ),
      GoRoute(
        path: '/admin',
        name: 'admin',
        builder: (context, state) => const AdminPage(),
      ),
      GoRoute(
        path: '/live',
        name: 'go-live',
        builder: (context, state) => const GoLivePage(),
      ),
      GoRoute(
        path: '/marketplace',
        name: 'marketplace',
        builder: (context, state) => const ShopPage(),
      ),
      // Literal routes declared before the dynamic ':productId' route
      // below so they win the match instead of being swallowed as a
      // productId of "cart"/"wishlist".
      GoRoute(
        path: '/marketplace/cart',
        name: 'marketplace-cart',
        builder: (context, state) => const CartPage(),
      ),
      GoRoute(
        path: '/marketplace/wishlist',
        name: 'marketplace-wishlist',
        builder: (context, state) => const hammart_wishlist.WishlistPage(),
      ),
      GoRoute(
        path: '/marketplace/product/:productId',
        name: 'marketplace-product',
        builder: (context, state) {
          final productId = state.pathParameters['productId'] ?? '';
          return ProductDetailPage(productId: productId);
        },
      ),
      GoRoute(
        path: '/notifications',
        name: 'notifications',
        builder: (context, state) => const NotificationsPage(),
      ),
      GoRoute(
        path: '/my-videos',
        name: 'my-videos',
        builder: (context, state) => const MyChannelStudioPage(),
      ),
      GoRoute(
        path: '/liked-videos',
        name: 'liked-videos',
        builder: (context, state) => VideoListPage(
          title: 'Liked Videos',
          emptyIcon: Icons.thumb_up_alt_outlined,
          emptyMessage: "You haven't liked any videos yet",
          loader: (ref) => ref.read(videoServiceProvider).getLikedVideos(),
        ),
      ),
      GoRoute(
        path: '/watch-history',
        name: 'watch-history',
        builder: (context, state) => const WatchHistoryPage(),
      ),
      GoRoute(
        path: '/history',
        name: 'history',
        builder: (context, state) => const WatchHistoryPage(),
      ),
      GoRoute(
        path: '/watchlist',
        name: 'watchlist',
        builder: (context, state) => const WatchlistPage(),
      ),
      GoRoute(
        path: '/downloads',
        name: 'downloads',
        builder: (context, state) => const DownloadsPage(),
      ),
      GoRoute(
        path: '/playlists',
        name: 'playlists',
        builder: (context, state) => const PlaylistsPage(),
      ),
      GoRoute(
        path: '/playlists/:playlistId',
        name: 'playlist-detail',
        builder: (context, state) {
          final playlistId = state.pathParameters['playlistId'] ?? '';
          final name = state.extra is String ? state.extra as String : null;
          return PlaylistDetailPage(playlistId: playlistId, name: name);
        },
      ),
      GoRoute(
        path: '/music/genre/:genre',
        name: 'music-genre',
        builder: (context, state) {
          final genre = Uri.decodeComponent(state.pathParameters['genre'] ?? 'Other');
          return GenrePage(genre: genre);
        },
      ),
      GoRoute(
        path: '/music/liked',
        name: 'music-liked',
        builder: (context, state) => const LikedMusicPage(),
      ),
      GoRoute(
        path: '/contact',
        name: 'contact-us',
        builder: (context, state) => const ContactUsPage(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Page not found'),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => context.go('/'),
              child: const Text('Go Home'),
            ),
          ],
        ),
      ),
    ),
  );
});
