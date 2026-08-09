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
import '../../features/creator_studio/presentation/pages/creator_studio_page.dart';
import '../../features/shop/presentation/pages/shop_page.dart';

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
        path: '/messages',
        name: 'messages',
        builder: (context, state) => const MessagesPage(),
      ),
      GoRoute(
        path: '/creator-studio',
        name: 'creator-studio',
        builder: (context, state) => const CreatorStudioPage(),
      ),
      GoRoute(
        path: '/marketplace',
        name: 'marketplace',
        builder: (context, state) => const ShopPage(),
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
