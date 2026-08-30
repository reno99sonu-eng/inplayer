import '../core/config/app_config.dart';

/// One row from GET /api/messages ("conversations" or "requests" — same
/// shape either way, see that route's own comment for why: a request is
/// just a conversation with requestStatus "pending" that someone ELSE
/// started). Also backs GET /api/messages/{id}'s single-conversation
/// response.
class Conversation {
  final String conversationId;
  final String otherUserId;
  final String? otherUsername;
  final String? otherAvatarUrl;
  final String requestStatus; // 'pending' | 'accepted'
  final String initiatedBy;
  final String lastMessageText;
  final String? lastMessageSenderId;
  final String? lastMessageAt;
  final int unreadCount;
  final bool blocked;
  final bool blockedByOther;
  final bool muted;
  final String? chatTheme;
  final bool disappearingEnabled;
  final int? disappearingSeconds;

  Conversation({
    required this.conversationId,
    required this.otherUserId,
    this.otherUsername,
    this.otherAvatarUrl,
    this.requestStatus = 'accepted',
    required this.initiatedBy,
    this.lastMessageText = '',
    this.lastMessageSenderId,
    this.lastMessageAt,
    this.unreadCount = 0,
    this.blocked = false,
    this.blockedByOther = false,
    this.muted = false,
    this.chatTheme,
    this.disappearingEnabled = false,
    this.disappearingSeconds,
  });

  static String? _resolveUrl(String? url) {
    if (url == null || url.isEmpty) return null;
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/')) return '${AppConfig.apiBaseUrl}$url';
    return url;
  }

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      conversationId: json['conversationId']?.toString() ?? '',
      otherUserId: json['otherUserId']?.toString() ?? '',
      otherUsername: json['otherUsername'] as String?,
      otherAvatarUrl: _resolveUrl(json['otherAvatarUrl'] as String?),
      requestStatus: json['requestStatus']?.toString() ?? 'accepted',
      initiatedBy: json['initiatedBy']?.toString() ?? '',
      lastMessageText: json['lastMessageText']?.toString() ?? '',
      lastMessageSenderId: json['lastMessageSenderId'] as String?,
      lastMessageAt: json['lastMessageAt'] as String?,
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      blocked: json['blocked'] == true,
      blockedByOther: json['blockedByOther'] == true,
      muted: json['muted'] == true,
      chatTheme: json['chatTheme'] as String?,
      disappearingEnabled: json['disappearingEnabled'] == true,
      disappearingSeconds: (json['disappearingSeconds'] as num?)?.toInt(),
    );
  }
}
