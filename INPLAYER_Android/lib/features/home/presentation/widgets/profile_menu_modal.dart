import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../providers/auth_provider.dart';

class ProfileMenuModal extends ConsumerWidget {
  const ProfileMenuModal({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final user = authState is AuthStateAuthenticated ? authState.user : null;
    final isDark = context.isDark;

    return Container(
      width: 300,
      margin: const EdgeInsets.only(bottom: 74, right: 12),
      decoration: BoxDecoration(
        color: (isDark ? const Color(0xFF08111F) : const Color(0xFFF5EEDC)).withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.10) : Colors.black.withValues(alpha: 0.08),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.50 : 0.20),
            blurRadius: 50,
            offset: const Offset(0, 20),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // 1. User Header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  children: [
                    UserAvatar(
                      avatarUrl: user?.avatarUrl,
                      name: user?.name ?? 'User',
                      size: 40,
                      isVerified: false,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            user?.name ?? 'InPlayer User',
                            style: TextStyle(
                              color: isDark ? Colors.white : const Color(0xFF0F172A),
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.2,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 1),
                          Text(
                            user?.email ?? '',
                            style: TextStyle(
                              color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                              fontSize: 11.5,
                              fontWeight: FontWeight.w500,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              Divider(
                color: isDark ? Colors.white.withValues(alpha: 0.10) : Colors.black.withValues(alpha: 0.08),
                height: 1,
                thickness: 1,
              ),

              // 2. Menu Items
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                child: Column(
                  children: [
                    _buildItem(
                      context: context,
                      icon: Icons.person_outline_rounded,
                      label: 'Your Channel',
                      onTap: () {
                        Navigator.pop(context);
                        context.push('/my-videos');
                      },
                    ),
                    _buildItem(
                      context: context,
                      icon: Icons.favorite_border_rounded,
                      label: 'Watchlist',
                      onTap: () {
                        Navigator.pop(context);
                        context.push('/watchlist');
                      },
                    ),
                    _buildItem(
                      context: context,
                      icon: Icons.chat_bubble_outline_rounded,
                      label: 'My MilonBook',
                      onTap: () {
                        Navigator.pop(context);
                        context.push('/messages');
                      },
                    ),
                    _buildItem(
                      context: context,
                      icon: Icons.settings_outlined,
                      label: 'Settings',
                      onTap: () {
                        Navigator.pop(context);
                        context.push('/settings');
                      },
                    ),
                  ],
                ),
              ),

              Divider(
                color: isDark ? Colors.white.withValues(alpha: 0.10) : Colors.black.withValues(alpha: 0.08),
                height: 1,
                thickness: 1,
              ),

              // 3. Sign Out Action
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () async {
                      Navigator.pop(context);
                      await ref.read(authStateProvider.notifier).signOut();
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      child: Row(
                        children: const [
                          Icon(
                            Icons.logout_rounded,
                            color: Color(0xFFF87171),
                            size: 18,
                          ),
                          SizedBox(width: 12),
                          Text(
                            'Sign Out',
                            style: TextStyle(
                              color: Color(0xFFF87171),
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildItem({
    required BuildContext context,
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    final isDark = context.isDark;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Icon(
                icon,
                color: AppColors.brandOrange,
                size: 18,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    color: isDark ? Colors.white : const Color(0xFF0F172A),
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> showMobileProfileMenu(BuildContext context) {
  return showGeneralDialog(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Account Menu',
    barrierColor: Colors.black.withValues(alpha: 0.35),
    transitionDuration: const Duration(milliseconds: 200),
    pageBuilder: (ctx, anim1, anim2) {
      return const Align(
        alignment: Alignment.bottomRight,
        child: Material(
          color: Colors.transparent,
          child: ProfileMenuModal(),
        ),
      );
    },
    transitionBuilder: (ctx, anim1, anim2, child) {
      return SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.08),
          end: Offset.zero,
        ).animate(CurvedAnimation(parent: anim1, curve: Curves.easeOutCubic)),
        child: FadeTransition(
          opacity: anim1,
          child: child,
        ),
      );
    },
  );
}
