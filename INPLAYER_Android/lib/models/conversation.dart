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
  final bool isGroup;
  final String? groupName;
  final String? creatorId;
  final List<String> memberUserIds;

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
    this.isGroup = false,
    this.groupName,
    this.creatorId,
    this.memberUserIds = const [],
  });

  Conversation copyWith({
    String? requestStatus,
    int? unreadCount,
    String? groupName,
    List<String>? memberUserIds,
  }) {
    return Conversation(
      conversationId: conversationId,
      otherUserId: otherUserId,
      otherUsername: otherUsername,
      otherAvatarUrl: otherAvatarUrl,
      requestStatus: requestStatus ?? this.requestStatus,
      initiatedBy: initiatedBy,
      lastMessageText: lastMessageText,
      lastMessageSenderId: lastMessageSenderId,
      lastMessageAt: lastMessageAt,
      unreadCount: unreadCount ?? this.unreadCount,
      blocked: blocked,
      blockedByOther: blockedByOther,
      muted: muted,
      chatTheme: chatTheme,
      disappearingEnabled: disappearingEnabled,
      disappearingSeconds: disappearingSeconds,
      isGroup: isGroup,
      groupName: groupName ?? this.groupName,
      creatorId: creatorId,
      memberUserIds: memberUserIds ?? this.memberUserIds,
    );
  }

  static String? _resolveUrl(String? url) {
    if (url == null || url.isEmpty) return null;
    if (url.startsWith('data:') ||
        url.startsWith('http://') ||
        url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/')) return '${AppConfig.apiBaseUrl}$url';
    return url;
  }

  factory Conversation.fromJson(Map<String, dynamic> json) {
    final convId = json['conversationId']?.toString() ?? '';
    final isGroup = json['isGroup'] == true || convId.startsWith('group_');
    final groupName = json['groupName'] as String?;
    final otherUsername = isGroup
        ? (groupName ?? json['otherUsername'] as String? ?? 'Group Chat')
        : json['otherUsername'] as String?;

    return Conversation(
      conversationId: convId,
      otherUserId: json['otherUserId']?.toString() ?? '',
      otherUsername: otherUsername,
      otherAvatarUrl: _resolveUrl(json['otherAvatarUrl'] as String?),
      requestStatus: json['requestStatus']?.toString() ?? 'accepted',
      initiatedBy: json['initiatedBy']?.toString() ?? '',
      lastMessageText: json['lastMessageText']?.toString() ?? json['lastMessage']?.toString() ?? '',
      lastMessageSenderId: json['lastMessageSenderId'] as String?,
      lastMessageAt: json['lastMessageAt'] as String?,
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      blocked: json['blocked'] == true,
      blockedByOther: json['blockedByOther'] == true,
      muted: json['muted'] == true,
      chatTheme: json['chatTheme'] as String?,
      disappearingEnabled: json['disappearingEnabled'] == true,
      disappearingSeconds: (json['disappearingSeconds'] as num?)?.toInt(),
      isGroup: isGroup,
      groupName: groupName,
      creatorId: json['creatorId'] as String?,
      memberUserIds: (json['memberUserIds'] as List?)?.map((e) => e.toString()).toList() ?? const [],
    );
  }
}
