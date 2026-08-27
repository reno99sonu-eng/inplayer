import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// One-time Native-style Notification Permission Prompt for Android 13+.
/// Requests permission with a clean, branded pre-prompt explanation dialog.
class NotificationPermissionHelper {
  NotificationPermissionHelper._();

  static const _askedKey = 'inplayer:notification_permission_asked';

  /// Prompts the user once on startup if not already requested.
  static Future<void> maybePrompt(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    final alreadyAsked = prefs.getBool(_askedKey) ?? false;
    if (alreadyAsked || !context.mounted) return;

    await prefs.setBool(_askedKey, true);
    if (!context.mounted) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: ctx.bgCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: ctx.borderSubtle),
        ),
        icon: const CircleAvatar(
          radius: 28,
          backgroundColor: Color(0x22F97316),
          child: Icon(Icons.notifications_active_rounded, color: AppColors.brandOrange, size: 28),
        ),
        title: Text(
          'Allow InPlayer Notifications?',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: ctx.textPrimary,
            fontWeight: FontWeight.w800,
            fontSize: 18,
          ),
        ),
        content: Text(
          'Get instant updates for new video releases from your subscribed creators, live streams, music drops, and community replies.',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: ctx.textSecondary,
            fontSize: 13,
            height: 1.4,
          ),
        ),
        actionsAlignment: MainAxisAlignment.spaceBetween,
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              'Don\'t Allow',
              style: TextStyle(
                color: ctx.textDim,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.brandOrange,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            ),
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text(
              'Allow',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
