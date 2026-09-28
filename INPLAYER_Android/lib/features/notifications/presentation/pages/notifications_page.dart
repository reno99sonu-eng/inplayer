import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../services/notification_service.dart';
import '../../../../services/notification_badge_service.dart';
import '../../../../services/message_service.dart';
import '../../../../models/notification_item.dart';

class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  bool _loading = true;
  List<NotificationItem> _notifications = [];
  final Set<String> _respondingToRequests = {};
  Map<String, String> _messageRequestStates = {};

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
    final notificationFuture = ref
        .read(notificationServiceProvider)
        .getNotifications();
    final conversationsFuture = ref
        .read(messageServiceProvider)
        .getConversations();
    final notifications = await notificationFuture;
    final conversations = await conversationsFuture;
    if (!mounted) return;
    final requestStates = <String, String>{
      for (final conversation in conversations.requests)
        conversation.conversationId: 'pending',
      for (final conversation in conversations.conversations)
        conversation.conversationId: conversation.requestStatus,
    };
    if (conversations.success) {
      for (final notification in notifications) {
        final id = notification.conversationId;
        if (notification.type == 'message_request' &&
            id != null &&
            !requestStates.containsKey(id)) {
          requestStates[id] = 'unavailable';
        }
      }
    }
    setState(() {
      _notifications = notifications;
      _messageRequestStates = requestStates;
      _loading = false;
    });

    if (notifications.any((n) => !n.read)) {
      ref.read(notificationServiceProvider).markAllRead();
    }
  }

  IconData _iconFor(NotificationItem n) {
    final type = n.type;
    final msg = n.message.toLowerCase();
    if (type == 'share' || msg.contains('shared your')) {
      return Icons.share_rounded;
    }
    if (type == 'copyright' || msg.contains('copyright')) {
      return Icons.copyright_rounded;
    }
    if (type == 'ai_flag' ||
        msg.contains('violating') ||
        msg.contains('content guidelines') ||
        msg.contains('strike') ||
        msg.contains('suspended') ||
        msg.contains('blocked')) {
      return Icons.security_rounded;
    }
    switch (type) {
      case 'video_upload':
        return Icons.video_library_rounded;
      case 'subscribe':
        return Icons.person_add_alt_1;
      case 'like':
        return Icons.thumb_up_alt;
      case 'comment':
        return Icons.mode_comment_outlined;
      case 'comment_reply':
        return Icons.reply_rounded;
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

  Color _iconColorFor(NotificationItem n) {
    final type = n.type;
    final msg = n.message.toLowerCase();
    if (type == 'ai_flag' ||
        msg.contains('violating') ||
        msg.contains('strike') ||
        msg.contains('suspended') ||
        msg.contains('blocked')) {
      return Colors.amber.shade700;
    }
    if (type == 'copyright' || msg.contains('copyright')) {
      return AppColors.brandOrange;
    }
    if (type == 'like') {
      return Colors.redAccent;
    }
    if (type == 'share' || msg.contains('shared your')) {
      return Colors.blueAccent;
    }
    return AppColors.brandOrange;
  }

  /// Whether tapping this row does anything
  bool _isTappable(NotificationItem n) {
    if (n.type == 'live_stream') return true;
    if (n.type == 'subscribe') return true;
    if (n.type == 'message_request') {
      return n.conversationId != null &&
          _messageRequestStates[n.conversationId] == 'accepted';
    }
    if (n.type == 'message') return n.conversationId != null;
    if (n.videoId != null) return true;
    final msg = n.message.toLowerCase();
    if (msg.contains('copyright') ||
        msg.contains('guidelines') ||
        msg.contains('strike') ||
        msg.contains('suspended') ||
        msg.contains('blocked')) {
      return true;
    }
    return false;
  }

  void _handleTap(NotificationItem n) {
    if (n.type == 'live_stream') {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            "Watching other creators' live streams isn't available in the app yet.",
          ),
          backgroundColor: context.isDark
              ? AppColors.surfaceDark
              : AppColors.surfaceLight,
        ),
      );
      return;
    }
    if (n.type == 'subscribe') {
      context.push('/studio');
      return;
    }
    if (n.type == 'message_request') {
      if (_messageRequestStates[n.conversationId] == 'accepted' &&
          n.conversationId != null) {
        context.push('/messages/${n.conversationId}');
      }
      return;
    }
    if (n.type == 'message' && n.conversationId != null) {
      context.push('/messages/${n.conversationId}');
      return;
    }
    if (n.videoId != null) {
      context.push('/watch/${n.videoId}');
      return;
    }
    final msg = n.message.toLowerCase();
    if (msg.contains('copyright') ||
        msg.contains('guidelines') ||
        msg.contains('strike') ||
        msg.contains('suspended') ||
        msg.contains('blocked')) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: ctx.bgModal,
          title: const Row(
            children: [
              Icon(Icons.info_outline, color: AppColors.brandOrange, size: 22),
              SizedBox(width: 8),
              Text(
                'Notice Detail',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          content: Text(
            n.message,
            style: TextStyle(color: ctx.textPrimary, fontSize: 14, height: 1.4),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text(
                'OK',
                style: TextStyle(
                  color: AppColors.brandOrange,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      );
      return;
    }
  }

  Future<void> _respondToMessageRequest(
    NotificationItem notification,
    bool accept,
  ) async {
    final conversationId = notification.conversationId;
    if (conversationId == null ||
        _respondingToRequests.contains(conversationId)) {
      return;
    }

    setState(() => _respondingToRequests.add(conversationId));
    final success = await ref
        .read(messageServiceProvider)
        .conversationAction(conversationId, accept ? 'accept' : 'decline');
    if (!mounted) return;

    setState(() {
      _respondingToRequests.remove(conversationId);
      if (success) {
        _messageRequestStates[conversationId] = accept
            ? 'accepted'
            : 'declined';
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          success
              ? (accept
                    ? 'Message request accepted.'
                    : 'Message request declined.')
              : "Couldn't update that message request. Try again.",
        ),
        backgroundColor: context.isDark
            ? AppColors.surfaceDark
            : AppColors.surfaceLight,
      ),
    );
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
                child: CircularProgressIndicator(color: AppColors.brandOrange),
              )
            : Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 720),
                  child: RefreshIndicator(
                    color: AppColors.brandOrange,
                    backgroundColor: context.bgCard,
                    onRefresh: _load,
                    child: _notifications.isEmpty
                        ? ListView(
                            children: [
                              SizedBox(
                                height:
                                    MediaQuery.of(context).size.height * 0.6,
                                child: Center(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.notifications_none,
                                        size: 48,
                                        color: context.textDim,
                                      ),
                                      const SizedBox(height: 16),
                                      Text(
                                        "You're all caught up",
                                        style: TextStyle(
                                          color: context.textSecondary,
                                        ),
                                      ),
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
                              final requestStatus = n.conversationId == null
                                  ? null
                                  : _messageRequestStates[n.conversationId];
                              final isRequest = n.type == 'message_request';
                              final canRespond =
                                  isRequest &&
                                  n.conversationId != null &&
                                  (requestStatus == null ||
                                      requestStatus == 'pending');
                              final isResponding =
                                  n.conversationId != null &&
                                  _respondingToRequests.contains(
                                    n.conversationId,
                                  );
                              return ListTile(
                                onTap: _isTappable(n)
                                    ? () => _handleTap(n)
                                    : null,
                                tileColor: n.read
                                    ? Colors.transparent
                                    : AppColors.brandOrange.withValues(
                                        alpha: 0.08,
                                      ),
                                leading: CircleAvatar(
                                  radius: 18,
                                  backgroundColor: context.isDark
                                      ? AppColors.surfaceDark
                                      : AppColors.surfaceLight,
                                  child: Icon(
                                    _iconFor(n),
                                    size: 18,
                                    color: _iconColorFor(n),
                                  ),
                                ),
                                title: Text(
                                  n.message,
                                  style: TextStyle(
                                    color: context.textPrimary,
                                    fontSize: 13.5,
                                    fontWeight: n.read
                                        ? FontWeight.normal
                                        : FontWeight.bold,
                                  ),
                                ),
                                subtitle: Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        n.timeAgo,
                                        style: TextStyle(
                                          color: context.textDim,
                                          fontSize: 11,
                                        ),
                                      ),
                                      if (isRequest && canRespond) ...[
                                        const SizedBox(height: 8),
                                        Wrap(
                                          spacing: 8,
                                          runSpacing: 4,
                                          children: [
                                            OutlinedButton(
                                              onPressed: isResponding
                                                  ? null
                                                  : () =>
                                                        _respondToMessageRequest(
                                                          n,
                                                          false,
                                                        ),
                                              style: OutlinedButton.styleFrom(
                                                visualDensity:
                                                    VisualDensity.compact,
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 12,
                                                      vertical: 4,
                                                    ),
                                              ),
                                              child: const Text('Reject'),
                                            ),
                                            FilledButton(
                                              onPressed: isResponding
                                                  ? null
                                                  : () =>
                                                        _respondToMessageRequest(
                                                          n,
                                                          true,
                                                        ),
                                              style: FilledButton.styleFrom(
                                                backgroundColor:
                                                    AppColors.brandOrange,
                                                foregroundColor: Colors.white,
                                                visualDensity:
                                                    VisualDensity.compact,
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 12,
                                                      vertical: 4,
                                                    ),
                                              ),
                                              child: isResponding
                                                  ? const SizedBox(
                                                      width: 14,
                                                      height: 14,
                                                      child:
                                                          CircularProgressIndicator(
                                                            strokeWidth: 2,
                                                          ),
                                                    )
                                                  : const Text('Accept'),
                                            ),
                                          ],
                                        ),
                                      ] else if (isRequest &&
                                          requestStatus != null) ...[
                                        const SizedBox(height: 5),
                                        Text(
                                          requestStatus == 'accepted'
                                              ? 'Request accepted'
                                              : requestStatus == 'declined'
                                              ? 'Request declined'
                                              : 'Request no longer available',
                                          style: TextStyle(
                                            color: context.textDim,
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ],
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
              ),
      ),
    );
  }
}
