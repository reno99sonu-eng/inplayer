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
  });

  factory Comment.fromJson(Map<String, dynamic> json) {
    return Comment(
      videoId: json['videoId']?.toString() ?? '',
      commentId: json['commentId']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      userName: json['userName']?.toString() ?? 'Anonymous',
      userAvatarUrl: json['userAvatarUrl'] as String?,
      userUsername: json['userUsername'] as String?,
      text: json['text']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
      isMember: json['isMember'] == true,
      isVerified: json['isVerified'] == true,
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
