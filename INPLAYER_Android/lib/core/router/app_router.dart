import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
import '../../features/creator_studio/presentation/pages/creator_studio_page.dart';
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
import '../../features/admin/presentation/pages/admin_page.dart';
import '../../features/live/presentation/pages/go_live_page.dart';
import '../../services/video_service.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final isAuthenticated = authState is AuthStateAuthenticated;
      final isVerificationPage = state.matchedLocation == '/verify';
      final isAuthPage =
          state.matchedLocation == '/signin' ||
          state.matchedLocation == '/signup';

      // If needs verification, redirect to verify page
      if (authState is AuthStateNeedsVerification && !isVerificationPage) {
        return '/verify?email=${authState.email}';
      }

      // If not authenticated and trying to access protected routes
      if (!isAuthenticated && !isAuthPage && !isVerificationPage) {
        return '/signin';
      }

      // If authenticated and trying to access auth pages
      if (isAuthenticated && isAuthPage) {
        return '/';
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
      GoRoute(
        path: '/watch/:videoId',
        name: 'watch',
        builder: (context, state) {
          final videoId = state.pathParameters['videoId'] ?? '';
          return WatchPage(videoId: videoId);
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
        builder: (context, state) => const CreatorStudioPage(),
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
        builder: (context, state) => VideoListPage(
          title: 'My Videos',
          emptyIcon: Icons.video_library_outlined,
          emptyMessage: "You haven't uploaded any videos yet",
          loader: (ref) => ref.read(videoServiceProvider).getMyVideos(),
        ),
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
        path: '/watchlist',
        name: 'watchlist',
        builder: (context, state) => const WatchlistPage(),
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
