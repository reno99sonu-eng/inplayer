import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../providers/auth_provider.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);

    if (authState is! AuthStateAuthenticated) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final user = authState.user;

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        title: const Text(
          'Profile',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimaryDark,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/notifications'),
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => context.push('/settings'),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Profile Header
            Container(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  // Avatar
                  CircleAvatar(
                    radius: 50,
                    backgroundColor: AppColors.surfaceDark,
                    backgroundImage: user.avatarUrl != null
                        ? smartImageProvider(user.avatarUrl!)
                        : null,
                    child: user.avatarUrl == null ||
                            smartImageProvider(user.avatarUrl!) == null
                        ? const Icon(Icons.person, size: 50)
                        : null,
                  ),
                  const SizedBox(height: 16),
                  // Name
                  Text(
                    user.name,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimaryDark,
                    ),
                  ),
                  const SizedBox(height: 4),
                  // Handle
                  if (user.handle != null)
                    Text(
                      '@${user.handle}',
                      style: const TextStyle(
                        color: AppColors.textSecondaryDark,
                      ),
                    ),
                  const SizedBox(height: 4),
                  // Email
                  Text(
                    user.email,
                    style: const TextStyle(
                      color: AppColors.textSecondaryDark,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Bio
                  if (user.bio.isNotEmpty)
                    Text(
                      user.bio,
                      style: const TextStyle(
                        color: AppColors.textSecondaryDark,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  const SizedBox(height: 24),
                  // Edit Profile Button
                  ElevatedButton(
                    onPressed: () {
                      // TODO: Navigate to edit profile
                    },
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(200, 40),
                    ),
                    child: const Text('Edit Profile'),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.cardDark),
            // Menu Items
            _buildMenuItem(
              icon: Icons.dashboard,
              title: 'Creator Studio',
              onTap: () => context.push('/creator-studio'),
            ),
            _buildMenuItem(
              icon: Icons.video_library,
              title: 'My Videos',
              onTap: () => context.push('/my-videos'),
            ),
            _buildMenuItem(
              icon: Icons.thumb_up,
              title: 'Liked Videos',
              onTap: () => context.push('/liked-videos'),
            ),
            _buildMenuItem(
              icon: Icons.history,
              title: 'Watch History',
              onTap: () => context.push('/watch-history'),
            ),
            _buildMenuItem(
              icon: Icons.bookmark,
              title: 'Watchlist',
              onTap: () => context.push('/watchlist'),
            ),
            _buildMenuItem(
              icon: Icons.playlist_play,
              title: 'Playlists',
              onTap: () => context.push('/playlists'),
            ),
            _buildMenuItem(
              icon: Icons.message,
              title: 'Messages',
              onTap: () => context.push('/messages'),
            ),
            _buildMenuItem(
              icon: Icons.download,
              title: 'Downloads',
              onTap: () {
                // There's no real download pipeline yet — videos are Mux
                // HLS streams, not files — so this is an honest "not yet"
                // rather than a fake button that looks like it works.
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text("Downloads aren't available yet."),
                    backgroundColor: AppColors.surfaceDark,
                  ),
                );
              },
            ),
            const Divider(height: 1, color: AppColors.cardDark),
            _buildMenuItem(
              icon: Icons.logout,
              title: 'Sign Out',
              onTap: () {
                ref.read(authStateProvider.notifier).signOut();
              },
              isDestructive: true,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    bool isDestructive = false,
  }) {
    return ListTile(
      leading: Icon(
        icon,
        color: isDestructive ? AppColors.error : AppColors.textPrimaryDark,
      ),
      title: Text(
        title,
        style: TextStyle(
          color: isDestructive ? AppColors.error : AppColors.textPrimaryDark,
        ),
      ),
      onTap: onTap,
    );
  }
}