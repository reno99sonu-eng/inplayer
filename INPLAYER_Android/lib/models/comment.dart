/// One comment on a video, as returned by GET /api/comments?videoId=X
/// (app/api/comments/route.ts). The route snapshots the commenter's name
/// and avatar onto the comment itself at post time, and enriches the list
/// with `userUsername`/`isMember`/`isVerified` server-side — no extra
/// per-commenter lookups needed here.
class Comment {
  final String videoId;
  final String commentId;
  final String userId;
  final String userName;
  final String? userAvatarUrl;
  final String? userUsername;
  final String text;
  final String createdAt;
  final bool isMember;
  final bool isVerified;

  final String? parentCommentId;
  final String? parentUserId;
  final String? parentUserName;
  final int likeCount;
  final int dislikeCount;
  final String? myReaction; // 'like' | 'dislike' | null
  final int replyCount;
  final List<Comment> replies;

  Comment({
    required this.videoId,
    required this.commentId,
    required this.userId,
    required this.userName,
    this.userAvatarUrl,
    this.userUsername,
    required this.text,
    required this.createdAt,
    this.isMember = false,
    this.isVerified = false,
    this.parentCommentId,
    this.parentUserId,
    this.parentUserName,
    this.likeCount = 0,
    this.dislikeCount = 0,
    this.myReaction,
    this.replyCount = 0,
    this.replies = const [],
  });

  static int _toInt(dynamic value) {
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  factory Comment.fromJson(Map<String, dynamic> json) {
    final rawReplies = json['replies'] as List<dynamic>? ?? const [];
    final parsedReplies = rawReplies
        .whereType<Map>()
        .map((r) => Comment.fromJson(Map<String, dynamic>.from(r)))
        .toList();

    return Comment(
      videoId: json['videoId']?.toString() ?? '',
      commentId: json['commentId']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      userName: json['userName']?.toString() ??
          json['uploaderName']?.toString() ??
          json['userUsername']?.toString() ??
          json['name']?.toString() ??
          'Anonymous',
      userAvatarUrl: json['userAvatarUrl']?.toString() ??
          json['avatarUrl']?.toString() ??
          json['avatar']?.toString(),
      userUsername: json['userUsername']?.toString() ??
          json['username']?.toString() ??
          json['handle']?.toString(),
      text: json['text']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
      isMember: json['isMember'] == true,
      isVerified: json['isVerified'] == true,
      parentCommentId: json['parentCommentId']?.toString(),
      parentUserId: json['parentUserId']?.toString(),
      parentUserName: json['parentUserName']?.toString(),
      likeCount: _toInt(json['likeCount']),
      dislikeCount: _toInt(json['dislikeCount']),
      myReaction: json['myReaction']?.toString(),
      replyCount: parsedReplies.isNotEmpty
          ? parsedReplies.length
          : _toInt(json['replyCount']),
      replies: parsedReplies,
    );
  }

  /// Groups flat comment items into top-level threads with nested replies.
  static List<Comment> assembleThreadedComments(List<Comment> rawList) {
    final Map<String, List<Comment>> repliesMap = {};

    for (final c in rawList) {
      final pid = c.parentCommentId?.trim();
      if (pid != null && pid.isNotEmpty) {
        repliesMap.putIfAbsent(pid, () => []).add(c);
      }
    }

    final List<Comment> result = [];
    for (final c in rawList) {
      final pid = c.parentCommentId?.trim();
      if (pid == null || pid.isEmpty) {
        final directReplies = repliesMap[c.commentId] ?? [];
        // Combine server-nested replies and grouped flat replies without duplicates
        final mergedReplies = <Comment>[...c.replies];
        for (final r in directReplies) {
          if (!mergedReplies.any((existing) => existing.commentId == r.commentId)) {
            mergedReplies.add(r);
          }
        }
        // Chronological order for replies
        mergedReplies.sort((a, b) => a.createdAt.compareTo(b.createdAt));

        result.add(c.copyWith(
          replies: mergedReplies,
          replyCount: mergedReplies.length > c.replyCount
              ? mergedReplies.length
              : c.replyCount,
        ));
      }
    }
    return result;
  }

  /// The cleanest identifier to open this user's channel/profile page:
  /// preferably the claimed @username (without leading '@'), or falling
  /// back to their unique userId.
  String? get profileIdentifier {
    final handle = userUsername?.trim().replaceFirst(RegExp(r'^@'), '');
    if (handle != null && handle.isNotEmpty) return handle;
    final uid = userId.trim();
    if (uid.isNotEmpty) return uid;
    return null;
  }

  Comment copyWith({
    String? videoId,
    String? commentId,
    String? userId,
    String? userName,
    String? userAvatarUrl,
    String? userUsername,
    String? text,
    String? createdAt,
    bool? isMember,
    bool? isVerified,
    String? parentCommentId,
    String? parentUserId,
    String? parentUserName,
    int? likeCount,
    int? dislikeCount,
    String? myReaction,
    int? replyCount,
    List<Comment>? replies,
  }) {
    return Comment(
      videoId: videoId ?? this.videoId,
      commentId: commentId ?? this.commentId,
      userId: userId ?? this.userId,
      userName: userName ?? this.userName,
      userAvatarUrl: userAvatarUrl ?? this.userAvatarUrl,
      userUsername: userUsername ?? this.userUsername,
      text: text ?? this.text,
      createdAt: createdAt ?? this.createdAt,
      isMember: isMember ?? this.isMember,
      isVerified: isVerified ?? this.isVerified,
      parentCommentId: parentCommentId ?? this.parentCommentId,
      parentUserId: parentUserId ?? this.parentUserId,
      parentUserName: parentUserName ?? this.parentUserName,
      likeCount: likeCount ?? this.likeCount,
      dislikeCount: dislikeCount ?? this.dislikeCount,
      myReaction: myReaction ?? this.myReaction,
      replyCount: replyCount ?? this.replyCount,
      replies: replies ?? this.replies,
    );
  }

  /// A friendly "3h ago" / "2d ago" label, matching the style used
  /// elsewhere in the app (see Video's own _formatTimeAgo).
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
