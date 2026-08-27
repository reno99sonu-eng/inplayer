/// One row from GET /api/notifications (app/api/notifications/route.ts).
/// `type` is one of 'subscribe' | 'like' | 'comment' | 'comment_reply' |
/// 'message' | 'message_request' | 'admin_announcement' | 'live_stream' —
/// see app/api/subscriptions, app/api/likes, app/api/comments, and
/// app/lib/notifications.ts for who writes each kind. `message` is already
/// a complete, ready-to-render sentence written server-side (e.g. "Jane
/// subscribed to your channel"), so this model doesn't need to reconstruct
/// copy client-side. `conversationId` is only present on 'message' /
/// 'message_request' rows — it's what the bell uses to route a tap to the
/// right conversation (matches the website's NavbarActions.tsx exactly).
class NotificationItem {
  final String userId;
  final String notificationId;
  final String type;
  final String message;
  final String? videoId;
  final String? conversationId;
  final bool read;
  final String createdAt;

  NotificationItem({
    required this.userId,
    required this.notificationId,
    required this.type,
    required this.message,
    this.videoId,
    this.conversationId,
    this.read = false,
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      userId: json['userId']?.toString() ?? '',
      notificationId: json['notificationId']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      message: json['message']?.toString() ?? '',
      videoId: json['videoId'] as String?,
      conversationId: json['conversationId'] as String?,
      read: json['read'] == true,
      createdAt: json['createdAt']?.toString() ?? '',
    );
  }

  String get timeAgo {
    DateTime? dateTime;
    try {
      dateTime = DateTime.parse(createdAt);
    } catch (_) {
      return '';
    }

    final diff = DateTime.now().difference(dateTime);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 30) return '${diff.inDays}d ago';
    return '${(diff.inDays / 30).floor()}mo ago';
  }
}
