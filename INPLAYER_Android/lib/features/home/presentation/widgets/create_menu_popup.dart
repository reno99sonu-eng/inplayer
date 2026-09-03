import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

class CreateMenuPopup extends StatelessWidget {
  const CreateMenuPopup({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;

    return Container(
      constraints: const BoxConstraints(maxWidth: 360),
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
      decoration: BoxDecoration(
        color: (isDark ? const Color(0xFF08111F) : const Color(0xFFF5EEDC)).withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: AppColors.brandOrange.withValues(alpha: isDark ? 0.25 : 0.35),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.60 : 0.20),
            blurRadius: 40,
            offset: const Offset(0, 15),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 6, 8, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Create',
                        style: TextStyle(
                          color: context.textPrimary,
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.4,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Start creating on InPlayer',
                        style: TextStyle(
                          color: context.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),

                Divider(color: context.borderSubtle, height: 1),
                const SizedBox(height: 8),

                // Upload Video
                _buildCreateItem(
                  context: context,
                  icon: Icons.videocam_rounded,
                  title: 'Upload',
                  subtitle: 'Video • Raftaar • Music',
                  gradient: const LinearGradient(
                    colors: [Color(0xFFEF4444), Color(0xFFF97316)],
                  ),
                  onTap: () {
                    Navigator.pop(context);
                    context.push('/upload');
                  },
                ),

                // Go Live
                _buildCreateItem(
                  context: context,
                  icon: Icons.podcasts_rounded,
                  title: 'Go Live',
                  subtitle: 'Streaming & Events',
                  gradient: const LinearGradient(
                    colors: [Color(0xFFF97316), Color(0xFFFBBF24)],
                  ),
                  onTap: () {
                    Navigator.pop(context);
                    context.push('/live');
                  },
                ),

                // Podcast and AI Studio removed on purpose. Podcast was a
                // duplicate — it pushed '/upload', exactly the same route as
                // Upload above, so it was a second door into one screen. The
                // menu is now the two things you can actually start here.
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCreateItem({
    required BuildContext context,
    required IconData icon,
    required String title,
    required String subtitle,
    required Gradient gradient,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: gradient,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.25),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Icon(icon, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: context.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: context.textSecondary,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> showCreateMenuPopup(BuildContext context) {
  return showGeneralDialog(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Create Menu',
    barrierColor: Colors.black.withValues(alpha: 0.65),
    transitionDuration: const Duration(milliseconds: 220),
    pageBuilder: (ctx, anim1, anim2) {
      return const Align(
        alignment: Alignment.bottomCenter,
        child: Material(
          color: Colors.transparent,
          child: CreateMenuPopup(),
        ),
      );
    },
    transitionBuilder: (ctx, anim1, anim2, child) {
      return SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.2),
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
