import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/notification_service.dart';
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

    // Mirror the website: opening the notification panel marks everything
    // as read. Fire-and-forget — the list still shows unread styling for
    // this pass so the user can see what's new before it clears.
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
      default:
        return Icons.notifications_outlined;
    }
  }

  // Live-stream notifications carry a real videoId, but there's no
  // backend endpoint yet for the app to fetch/watch someone else's live
  // stream (see api_constants.dart's liveCreate/liveEnd doc comment) — the
  // website's own live viewer page reads straight from DynamoDB
  // server-side with no REST equivalent. Routing this tap to /watch/{id}
  // would just dead-end on "video not found" since that endpoint only
  // returns ready VOD videos, so this says so honestly instead.
  void _handleTap(NotificationItem n) {
    if (n.type == 'live_stream') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Watching other creators' live streams isn't available in the app yet."),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
      return;
    }
    if (n.videoId != null) {
      context.push('/watch/${n.videoId}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: const Text(
          'Notifications',
          style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimaryDark),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.brandOrange))
          : RefreshIndicator(
              color: AppColors.brandOrange,
              backgroundColor: AppColors.surfaceDark,
              onRefresh: _load,
              child: _notifications.isEmpty
                  ? ListView(
                      children: [
                        SizedBox(
                          height: MediaQuery.of(context).size.height * 0.6,
                          child: const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.notifications_none,
                                    size: 48, color: AppColors.textSecondaryDark),
                                SizedBox(height: 16),
                                Text("You're all caught up",
                                    style:
                                        TextStyle(color: AppColors.textSecondaryDark)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      itemCount: _notifications.length,
                      separatorBuilder: (context, index) =>
                          const Divider(height: 1, color: AppColors.cardDark),
                      itemBuilder: (context, index) {
                        final n = _notifications[index];
                        return ListTile(
                          onTap: n.videoId == null && n.type != 'live_stream'
                              ? null
                              : () => _handleTap(n),
                          tileColor: n.read
                              ? Colors.transparent
                              : AppColors.brandOrange.withValues(alpha: 0.06),
                          leading: CircleAvatar(
                            radius: 18,
                            backgroundColor: AppColors.surfaceDark,
                            child: Icon(_iconFor(n.type),
                                size: 18, color: AppColors.brandOrange),
                          ),
                          title: Text(
                            n.message,
                            style: const TextStyle(
                              color: AppColors.textPrimaryDark,
                              fontSize: 13.5,
                            ),
                          ),
                          subtitle: Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              n.timeAgo,
                              style: const TextStyle(
                                color: AppColors.textSecondaryDark,
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
    );
  }
}
