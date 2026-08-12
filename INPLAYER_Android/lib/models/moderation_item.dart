/// One row from GET /api/admin/moderation?tab=reports — a real
/// user-submitted report (see app/api/reports/route.ts for the exact
/// shape this mirrors: reportId, targetType, reason, details, status,
/// createdAt, plus whichever id fields the targetType needs).
class AdminReport {
  final String reportId;
  final String targetType; // 'video' | 'comment' | 'message'
  final String? videoId;
  final String? commentId;
  final String? conversationId;
  final String? messageId;
  final String reason;
  final String? details;
  final String? snippet;
  final String? createdAt;

  AdminReport({
    required this.reportId,
    required this.targetType,
    this.videoId,
    this.commentId,
    this.conversationId,
    this.messageId,
    required this.reason,
    this.details,
    this.snippet,
    this.createdAt,
  });

  factory AdminReport.fromJson(Map<String, dynamic> json) {
    return AdminReport(
      reportId: json['reportId']?.toString() ?? '',
      targetType: json['targetType']?.toString() ?? 'video',
      videoId: json['videoId'] as String?,
      commentId: json['commentId'] as String?,
      conversationId: json['conversationId'] as String?,
      messageId: json['messageId'] as String?,
      reason: json['reason']?.toString() ?? 'unspecified',
      details: json['details'] as String?,
      snippet: json['snippet'] as String?,
      createdAt: json['createdAt'] as String?,
    );
  }
}

/// One row from GET /api/admin/moderation?tab=autoflagged — content the
/// real-time AI moderation scan (app/lib/moderation.ts) held back on its
/// own, before any human reported it.
class AdminFlaggedItem {
  final String id;
  final String contentType; // 'comment' | 'message' | 'video'
  final String? videoId;
  final String? commentId;
  final String? conversationId;
  final String? messageId;
  final List<String> categories;
  final String snippet;
  final String? createdAt;

  AdminFlaggedItem({
    required this.id,
    required this.contentType,
    this.videoId,
    this.commentId,
    this.conversationId,
    this.messageId,
    this.categories = const [],
    this.snippet = '',
    this.createdAt,
  });

  factory AdminFlaggedItem.fromJson(Map<String, dynamic> json) {
    return AdminFlaggedItem(
      id: json['id']?.toString() ?? '',
      contentType: json['contentType']?.toString() ?? 'video',
      videoId: json['videoId'] as String?,
      commentId: json['commentId'] as String?,
      conversationId: json['conversationId'] as String?,
      messageId: json['messageId'] as String?,
      categories: (json['categories'] as List? ?? []).map((c) => c.toString()).toList(),
      snippet: json['snippet']?.toString() ?? '',
      createdAt: json['createdAt'] as String?,
    );
  }
}

/// One row from GET /api/admin/moderation?tab=strikes — an account the
/// automated 3-strike system (app/lib/moderationStrikes.ts) already
/// suspended on its own, waiting on a human to uphold or lift the ban.
class AdminStrikeUser {
  final String userId;
  final String? username;
  final String? name;
  final int aiModerationStrikes;
  final String? banReviewReason;
  final String? updatedAt;

  AdminStrikeUser({
    required this.userId,
    this.username,
    this.name,
    this.aiModerationStrikes = 0,
    this.banReviewReason,
    this.updatedAt,
  });

  factory AdminStrikeUser.fromJson(Map<String, dynamic> json) {
    return AdminStrikeUser(
      userId: json['userId']?.toString() ?? '',
      username: json['username'] as String?,
      name: json['name'] as String?,
      aiModerationStrikes: (json['aiModerationStrikes'] as num?)?.toInt() ?? 0,
      banReviewReason: json['banReviewReason'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }
}
