import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../services/notification_service.dart';
import '../../../../services/notification_badge_service.dart';
import '../../../../models/notification_item.dart';

class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  bool _loading = true;
  List<NotificationItem> _notifications = [];

  @override
  void initState() {
    super.initState();
    // Optimistic clear the instant this screen opens — matches the
    // website's bell, which zeroes the badge the moment the panel opens
    // rather than waiting on the markAllRead() request below to resolve.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(notificationBadgeServiceProvider).clear();
    });
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final notifications = await ref.read(notificationServiceProvider).getNotifications();
    if (!mounted) return;
    setState(() {
      _notifications = notifications;
      _loading = false;
    });

    if (notifications.any((n) => !n.read)) {
      ref.read(notificationServiceProvider).markAllRead();
    }
  }

  IconData _iconFor(String type) {
    switch (type) {
      case 'subscribe':
        return Icons.person_add_alt_1;
      case 'like':
        return Icons.thumb_up_alt;
      case 'comment':
      case 'comment_reply':
        return Icons.mode_comment_outlined;
      case 'live_stream':
        return Icons.podcasts;
      case 'message':
        return Icons.chat_bubble_outline_rounded;
      case 'message_request':
        return Icons.person_add_alt_1_outlined;
      case 'admin_announcement':
        return Icons.campaign_rounded;
      default:
        return Icons.notifications_outlined;
    }
  }

  bool _isMessageType(String type) => type == 'message' || type == 'message_request';

  /// Whether tapping this row does anything — mirrors [_handleTap]'s own
  /// branches so the row's tap target and its actual behavior never drift
  /// apart.
  bool _isTappable(NotificationItem n) {
    if (n.type == 'live_stream') return true;
    if (_isMessageType(n.type)) return n.conversationId != null;
    return n.videoId != null;
  }

  void _handleTap(NotificationItem n) {
    if (n.type == 'live_stream') {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text("Watching other creators' live streams isn't available in the app yet."),
          backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        ),
      );
      return;
    }
    // Matches the website's NavbarActions.tsx click routing exactly:
    // message/message_request rows go to their conversation, everything
    // else (that has one) goes to its video. admin_announcement rows have
    // neither and are display-only, same as on the website.
    if (_isMessageType(n.type) && n.conversationId != null) {
      context.push('/messages/${n.conversationId}');
      return;
    }
    if (n.videoId != null) {
      context.push('/watch/${n.videoId}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return PatternBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
          elevation: 0,
          iconTheme: IconThemeData(color: context.textPrimary),
          title: Text(
            'Notifications',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: context.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
        ),
        body: _loading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.brandOrange))
            : RefreshIndicator(
                color: AppColors.brandOrange,
                backgroundColor: context.bgCard,
                onRefresh: _load,
                child: _notifications.isEmpty
                    ? ListView(
                        children: [
                          SizedBox(
                            height: MediaQuery.of(context).size.height * 0.6,
                            child: Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.notifications_none,
                                      size: 48, color: context.textDim),
                                  const SizedBox(height: 16),
                                  Text("You're all caught up",
                                      style:
                                          TextStyle(color: context.textSecondary)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      )
                    : ListView.separated(
                        itemCount: _notifications.length,
                        separatorBuilder: (context, index) =>
                            Divider(height: 1, color: context.borderSubtle),
                        itemBuilder: (context, index) {
                          final n = _notifications[index];
                          return ListTile(
                            onTap: _isTappable(n) ? () => _handleTap(n) : null,
                            tileColor: n.read
                                ? Colors.transparent
                                : AppColors.brandOrange.withValues(alpha: 0.08),
                            leading: CircleAvatar(
                              radius: 18,
                              backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                              child: Icon(_iconFor(n.type),
                                  size: 18, color: AppColors.brandOrange),
                            ),
                            title: Text(
                              n.message,
                              style: TextStyle(
                                color: context.textPrimary,
                                fontSize: 13.5,
                                fontWeight: n.read ? FontWeight.normal : FontWeight.bold,
                              ),
                            ),
                            subtitle: Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                n.timeAgo,
                                style: TextStyle(
                                  color: context.textDim,
                                  fontSize: 11,
                                ),
                              ),
                            ),
                            trailing: n.read
                                ? null
                                : Container(
                                    width: 8,
                                    height: 8,
                                    decoration: const BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: AppColors.brandOrange,
                                    ),
                                  ),
                          );
                        },
                      ),
              ),
      ),
    );
  }
}
