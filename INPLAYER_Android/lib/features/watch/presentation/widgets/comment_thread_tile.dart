import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../models/comment.dart';
import '../../../../services/comment_service.dart';
import 'comment_report_sheet.dart';

/// A full-featured comment thread tile that supports:
/// - Comment author avatar & name navigation to channel profile
/// - Badges for Verified & Channel Member
/// - Like / Dislike reactions with optimistic updates and live counts
/// - Dedicated Reply button and inline composer ("Replying to @user...")
/// - Report button launching [CommentReportSheet]
/// - Expandable nested replies with vertical thread guide line
/// - Nested reply items with their own like/dislike/reply/report buttons
class CommentThreadTile extends ConsumerStatefulWidget {
  final Comment comment;
  final String videoId;
  final VoidCallback? onProfileNavigated;
  final ValueChanged<Comment>? onReplyAdded;
  final ValueChanged<String>? onCommentDeleted;

  const CommentThreadTile({
    super.key,
    required this.comment,
    required this.videoId,
    this.onProfileNavigated,
    this.onReplyAdded,
    this.onCommentDeleted,
  });

  @override
  ConsumerState<CommentThreadTile> createState() => _CommentThreadTileState();
}

class _CommentThreadTileState extends ConsumerState<CommentThreadTile> {
  // Top-level comment reaction state
  late int _likeCount;
  late int _dislikeCount;
  late String? _myReaction;
  bool _isReacting = false;

  // Replies state
  late List<Comment> _replies;
  bool _showReplies = false;

  // Inline Reply Composer state
  bool _isReplying = false;
  String? _replyTargetUserId;
  String? _replyTargetUserName;
  final _replyController = TextEditingController();
  final _replyFocusNode = FocusNode();
  bool _isSubmittingReply = false;

  @override
  void initState() {
    super.initState();
    _likeCount = widget.comment.likeCount;
    _dislikeCount = widget.comment.dislikeCount;
    _myReaction = widget.comment.myReaction;
    _replies = List.from(widget.comment.replies);
  }

  @override
  void didUpdateWidget(covariant CommentThreadTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.comment.commentId != widget.comment.commentId) {
      _likeCount = widget.comment.likeCount;
      _dislikeCount = widget.comment.dislikeCount;
      _myReaction = widget.comment.myReaction;
      _replies = List.from(widget.comment.replies);
    } else if (widget.comment.replies.length != _replies.length) {
      // Synchronize replies if updated from parent
      final existingIds = _replies.map((r) => r.commentId).toSet();
      for (final r in widget.comment.replies) {
        if (!existingIds.contains(r.commentId)) {
          _replies.add(r);
        }
      }
    }
  }

  @override
  void dispose() {
    _replyController.dispose();
    _replyFocusNode.dispose();
    super.dispose();
  }

  void _openProfile(String? target) {
    if (target == null || target.isEmpty) return;
    widget.onProfileNavigated?.call();
    context.push('/channel/${Uri.encodeComponent(target)}');
  }

  Future<void> _handleReaction(String action) async {
    if (_isReacting) return;

    final authState = ref.read(authStateProvider);
    if (authState is! AuthStateAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please sign in to react to comments.'),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
      return;
    }

    final prevReaction = _myReaction;
    final prevLikes = _likeCount;
    final prevDislikes = _dislikeCount;

    String effectiveAction = action;
    int nextLikes = _likeCount;
    int nextDislikes = _dislikeCount;
    String? nextReaction;

    if (action == 'like') {
      if (prevReaction == 'like') {
        effectiveAction = 'remove';
        nextReaction = null;
        nextLikes = max(0, _likeCount - 1);
      } else {
        effectiveAction = 'like';
        nextReaction = 'like';
        nextLikes = _likeCount + 1;
        if (prevReaction == 'dislike') {
          nextDislikes = max(0, _dislikeCount - 1);
        }
      }
    } else if (action == 'dislike') {
      if (prevReaction == 'dislike') {
        effectiveAction = 'remove';
        nextReaction = null;
        nextDislikes = max(0, _dislikeCount - 1);
      } else {
        effectiveAction = 'dislike';
        nextReaction = 'dislike';
        nextDislikes = _dislikeCount + 1;
        if (prevReaction == 'like') {
          nextLikes = max(0, _likeCount - 1);
        }
      }
    }

    setState(() {
      _isReacting = true;
      _myReaction = nextReaction;
      _likeCount = nextLikes;
      _dislikeCount = nextDislikes;
    });

    final res = await ref.read(commentServiceProvider).reactToComment(
          videoId: widget.videoId,
          commentId: widget.comment.commentId,
          action: effectiveAction,
        );

    if (!mounted) return;

    if (res.success) {
      setState(() {
        _isReacting = false;
        _likeCount = res.likeCount;
        _dislikeCount = res.dislikeCount;
        _myReaction = res.myReaction;
      });
    } else {
      // Revert optimistic update on failure
      setState(() {
        _isReacting = false;
        _myReaction = prevReaction;
        _likeCount = prevLikes;
        _dislikeCount = prevDislikes;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to update reaction.'),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
    }
  }

  void _startReply({required String userId, required String userName}) {
    final authState = ref.read(authStateProvider);
    if (authState is! AuthStateAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please sign in to reply.'),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
      return;
    }

    setState(() {
      _isReplying = true;
      _replyTargetUserId = userId;
      _replyTargetUserName = userName;
    });
    Future.delayed(const Duration(milliseconds: 100), () {
      if (mounted) _replyFocusNode.requestFocus();
    });
  }

  void _cancelReply() {
    setState(() {
      _isReplying = false;
      _replyTargetUserId = null;
      _replyTargetUserName = null;
      _replyController.clear();
    });
    _replyFocusNode.unfocus();
  }

  Future<void> _submitReply() async {
    final text = _replyController.text.trim();
    if (text.isEmpty || _isSubmittingReply) return;

    final authState = ref.read(authStateProvider);
    if (authState is! AuthStateAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please sign in to reply.'),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
      return;
    }

    setState(() => _isSubmittingReply = true);

    final res = await ref.read(commentServiceProvider).postComment(
          widget.videoId,
          text,
          parentCommentId: widget.comment.commentId,
          parentUserId: _replyTargetUserId ?? widget.comment.userId,
          parentUserName: _replyTargetUserName ?? widget.comment.userName,
        );

    if (!mounted) return;

    setState(() => _isSubmittingReply = false);

    if (res.requiresSignIn) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please sign in to reply.'),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
      return;
    }

    if (res.flagged) {
      _cancelReply();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Your reply was submitted for review.'),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
      return;
    }

    if (res.comment != null) {
      var newReply = res.comment!;
      if ((newReply.userUsername == null || newReply.userUsername!.isEmpty) &&
          authState.user.username.isNotEmpty) {
        newReply = newReply.copyWith(
          userUsername: authState.user.handle ?? authState.user.username,
        );
      }

      setState(() {
        _replies.add(newReply);
        _showReplies = true; // Automatically expand replies so the user sees it
      });

      _cancelReply();
      widget.onReplyAdded?.call(newReply);
    } else if (res.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res.error!),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
    }
  }

  Future<void> _handleDeleteComment() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: ctx.bgModal,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Delete comment?',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        content: const Text(
          'Are you sure you want to delete this comment? This action cannot be undone.',
          style: TextStyle(fontSize: 13.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Cancel', style: TextStyle(color: ctx.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text(
              'Delete',
              style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    final ok = await ref.read(commentServiceProvider).deleteComment(
          widget.videoId,
          widget.comment.commentId,
        );

    if (!mounted) return;

    if (ok) {
      widget.onCommentDeleted?.call(widget.comment.commentId);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Comment deleted.'),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to delete comment. Please try again.'),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
    }
  }

  void _onReplyDeleted(String replyId) {
    setState(() {
      _replies.removeWhere((r) => r.commentId == replyId);
    });
  }

  String _formatCount(int count) {
    if (count <= 0) return '';
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M';
    }
    if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}K';
    }
    return count.toString();
  }

  @override
  Widget build(BuildContext context) {
    final comment = widget.comment;
    final target = comment.profileIdentifier;
    final canNavigate = target != null && target.isNotEmpty;

    final authState = ref.watch(authStateProvider);
    final currentUser =
        authState is AuthStateAuthenticated ? authState.user : null;
    final isAuthor = currentUser != null && currentUser.userId == comment.userId;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top-level comment row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              UserAvatar(
                avatarUrl: comment.userAvatarUrl,
                name: comment.userName,
                size: 32,
                isVerified: comment.isVerified,
                onTap: canNavigate ? () => _openProfile(target) : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Author name, badges, and time
                    Row(
                      children: [
                        Flexible(
                          child: GestureDetector(
                            onTap: canNavigate ? () => _openProfile(target) : null,
                            child: Text(
                              comment.userName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: context.textPrimary,
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                        if (comment.isVerified) ...[
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.verified,
                            size: 12,
                            color: AppColors.brandGold,
                          ),
                        ],
                        if (comment.isMember) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 1,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.brandOrange.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'Member',
                              style: TextStyle(
                                color: AppColors.brandOrange,
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(width: 6),
                        Text(
                          comment.timeAgo,
                          style: TextStyle(
                            color: context.textDim,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),

                    // Comment text
                    Text(
                      comment.text,
                      style: TextStyle(
                        color: context.textSecondary,
                        fontSize: 13,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 6),

                    // Actions Bar: Like, Dislike, Reply, Delete/Report
                    _buildActionBar(
                      likeCount: _likeCount,
                      myReaction: _myReaction,
                      isAuthor: isAuthor,
                      onLikeTap: () => _handleReaction('like'),
                      onDislikeTap: () => _handleReaction('dislike'),
                      onReplyTap: () => _startReply(
                        userId: comment.userId,
                        userName: comment.userName,
                      ),
                      onDeleteTap: _handleDeleteComment,
                      onReportTap: () => showCommentReportSheet(
                        context,
                        videoId: widget.videoId,
                        comment: comment,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Inline Reply Composer
          if (_isReplying) _buildInlineReplyComposer(),

          // Replies Toggle & Threaded replies list
          if (_replies.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(left: 42, top: 4),
              child: InkWell(
                onTap: () => setState(() => _showReplies = !_showReplies),
                borderRadius: BorderRadius.circular(6),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _showReplies
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        size: 18,
                        color: AppColors.brandOrange,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _showReplies
                            ? 'Hide ${_replies.length} ${_replies.length == 1 ? "reply" : "replies"}'
                            : 'View ${_replies.length} ${_replies.length == 1 ? "reply" : "replies"}',
                        style: const TextStyle(
                          color: AppColors.brandOrange,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (_showReplies)
              Padding(
                padding: const EdgeInsets.only(left: 20, top: 6),
                child: Container(
                  decoration: BoxDecoration(
                    border: Border(
                      left: BorderSide(
                        color: context.borderSubtle.withValues(alpha: 0.6),
                        width: 1.5,
                      ),
                    ),
                  ),
                  padding: const EdgeInsets.only(left: 14),
                  child: Column(
                    children: _replies.map((reply) {
                      return _NestedReplyItem(
                        key: ValueKey(reply.commentId),
                        reply: reply,
                        videoId: widget.videoId,
                        onOpenProfile: _openProfile,
                        onReplyTap: (userId, userName) => _startReply(
                          userId: userId,
                          userName: userName,
                        ),
                        onDeleteTap: _onReplyDeleted,
                      );
                    }).toList(),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildActionBar({
    required int likeCount,
    required String? myReaction,
    required bool isAuthor,
    required VoidCallback onLikeTap,
    required VoidCallback onDislikeTap,
    required VoidCallback onReplyTap,
    required VoidCallback onDeleteTap,
    required VoidCallback onReportTap,
  }) {
    final isLiked = myReaction == 'like';
    final isDisliked = myReaction == 'dislike';

    return Row(
      children: [
        // Like button
        InkWell(
          onTap: onLikeTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isLiked
                      ? Icons.thumb_up_alt_rounded
                      : Icons.thumb_up_alt_outlined,
                  size: 15,
                  color: isLiked ? AppColors.brandOrange : context.textDim,
                ),
                if (likeCount > 0) ...[
                  const SizedBox(width: 4),
                  Text(
                    _formatCount(likeCount),
                    style: TextStyle(
                      color: isLiked ? AppColors.brandOrange : context.textDim,
                      fontSize: 11.5,
                      fontWeight:
                          isLiked ? FontWeight.w700 : FontWeight.normal,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),

        // Dislike button
        InkWell(
          onTap: onDislikeTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            child: Icon(
              isDisliked
                  ? Icons.thumb_down_alt_rounded
                  : Icons.thumb_down_alt_outlined,
              size: 15,
              color: isDisliked ? AppColors.brandOrange : context.textDim,
            ),
          ),
        ),
        const SizedBox(width: 16),

        // Reply button
        InkWell(
          onTap: onReplyTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.reply_rounded,
                  size: 16,
                  color: context.textDim,
                ),
                const SizedBox(width: 4),
                Text(
                  'Reply',
                  style: TextStyle(
                    color: context.textDim,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
        const Spacer(),

        // Delete button exclusively for the author, or Report for non-authors
        if (isAuthor)
          IconButton(
            icon: Icon(
              Icons.delete_outline_rounded,
              size: 16,
              color: context.textDim.withValues(alpha: 0.7),
            ),
            tooltip: 'Delete',
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            onPressed: onDeleteTap,
          )
        else
          IconButton(
            icon: Icon(
              Icons.flag_outlined,
              size: 15,
              color: context.textDim.withValues(alpha: 0.7),
            ),
            tooltip: 'Report',
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            onPressed: onReportTap,
          ),
      ],
    );
  }

  Widget _buildInlineReplyComposer() {
    final authState = ref.watch(authStateProvider);
    final currentUser =
        authState is AuthStateAuthenticated ? authState.user : null;

    return Container(
      margin: const EdgeInsets.only(left: 42, top: 8, bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: context.isDark
            ? Colors.white.withValues(alpha: 0.05)
            : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Target user header
          Row(
            children: [
              Text(
                'Replying to ',
                style: TextStyle(color: context.textDim, fontSize: 11.5),
              ),
              Text(
                '@${_replyTargetUserName ?? widget.comment.userName}',
                style: const TextStyle(
                  color: AppColors.brandOrange,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: _cancelReply,
                child: Icon(
                  Icons.close_rounded,
                  size: 16,
                  color: context.textDim,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Input field row
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              UserAvatar(
                avatarUrl: currentUser?.avatarUrl,
                name: currentUser?.displayName ?? 'User',
                size: 26,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _replyController,
                  focusNode: _replyFocusNode,
                  style: TextStyle(color: context.textPrimary, fontSize: 13),
                  minLines: 1,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: 'Write a reply...',
                    hintStyle: TextStyle(
                      color: context.textDim,
                      fontSize: 12.5,
                    ),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: context.borderSubtle),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: context.borderSubtle),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.brandOrange),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _isSubmittingReply
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.brandOrange,
                      ),
                    )
                  : IconButton(
                      icon: const Icon(
                        Icons.send_rounded,
                        color: AppColors.brandOrange,
                        size: 20,
                      ),
                      onPressed: _submitReply,
                    ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Dedicated view for a nested reply item inside a comment thread
class _NestedReplyItem extends ConsumerStatefulWidget {
  final Comment reply;
  final String videoId;
  final Function(String?) onOpenProfile;
  final Function(String userId, String userName) onReplyTap;
  final ValueChanged<String>? onDeleteTap;

  const _NestedReplyItem({
    super.key,
    required this.reply,
    required this.videoId,
    required this.onOpenProfile,
    required this.onReplyTap,
    this.onDeleteTap,
  });

  @override
  ConsumerState<_NestedReplyItem> createState() => _NestedReplyItemState();
}

class _NestedReplyItemState extends ConsumerState<_NestedReplyItem> {
  late int _likeCount;
  late int _dislikeCount;
  late String? _myReaction;
  bool _isReacting = false;

  @override
  void initState() {
    super.initState();
    _likeCount = widget.reply.likeCount;
    _dislikeCount = widget.reply.dislikeCount;
    _myReaction = widget.reply.myReaction;
  }

  @override
  void didUpdateWidget(covariant _NestedReplyItem oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reply.commentId != widget.reply.commentId ||
        oldWidget.reply.likeCount != widget.reply.likeCount ||
        oldWidget.reply.dislikeCount != widget.reply.dislikeCount ||
        oldWidget.reply.myReaction != widget.reply.myReaction) {
      _likeCount = widget.reply.likeCount;
      _dislikeCount = widget.reply.dislikeCount;
      _myReaction = widget.reply.myReaction;
    }
  }

  Future<void> _handleDeleteReply() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: ctx.bgModal,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Delete reply?',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        content: const Text(
          'Are you sure you want to delete this reply? This action cannot be undone.',
          style: TextStyle(fontSize: 13.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Cancel', style: TextStyle(color: ctx.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text(
              'Delete',
              style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    final ok = await ref.read(commentServiceProvider).deleteComment(
          widget.videoId,
          widget.reply.commentId,
        );

    if (!mounted) return;

    if (ok) {
      widget.onDeleteTap?.call(widget.reply.commentId);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Reply deleted.'),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to delete reply. Please try again.'),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
    }
  }

  Future<void> _handleReaction(String action) async {
    if (_isReacting) return;

    final authState = ref.read(authStateProvider);
    if (authState is! AuthStateAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please sign in to react to replies.'),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
      return;
    }

    final prevReaction = _myReaction;
    final prevLikes = _likeCount;
    final prevDislikes = _dislikeCount;

    String effectiveAction = action;
    int nextLikes = _likeCount;
    int nextDislikes = _dislikeCount;
    String? nextReaction;

    if (action == 'like') {
      if (prevReaction == 'like') {
        effectiveAction = 'remove';
        nextReaction = null;
        nextLikes = max(0, _likeCount - 1);
      } else {
        effectiveAction = 'like';
        nextReaction = 'like';
        nextLikes = _likeCount + 1;
        if (prevReaction == 'dislike') {
          nextDislikes = max(0, _dislikeCount - 1);
        }
      }
    } else if (action == 'dislike') {
      if (prevReaction == 'dislike') {
        effectiveAction = 'remove';
        nextReaction = null;
        nextDislikes = max(0, _dislikeCount - 1);
      } else {
        effectiveAction = 'dislike';
        nextReaction = 'dislike';
        nextDislikes = _dislikeCount + 1;
        if (prevReaction == 'like') {
          nextLikes = max(0, _likeCount - 1);
        }
      }
    }

    setState(() {
      _isReacting = true;
      _myReaction = nextReaction;
      _likeCount = nextLikes;
      _dislikeCount = nextDislikes;
    });

    final res = await ref.read(commentServiceProvider).reactToComment(
          videoId: widget.videoId,
          commentId: widget.reply.commentId,
          action: effectiveAction,
        );

    if (!mounted) return;

    if (res.success) {
      setState(() {
        _isReacting = false;
        _likeCount = res.likeCount;
        _dislikeCount = res.dislikeCount;
        _myReaction = res.myReaction;
      });
    } else {
      setState(() {
        _isReacting = false;
        _myReaction = prevReaction;
        _likeCount = prevLikes;
        _dislikeCount = prevDislikes;
      });
    }
  }

  String _formatCount(int count) {
    if (count <= 0) return '';
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M';
    }
    if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}K';
    }
    return count.toString();
  }

  @override
  Widget build(BuildContext context) {
    final reply = widget.reply;
    final target = reply.profileIdentifier;
    final canNavigate = target != null && target.isNotEmpty;
    final isLiked = _myReaction == 'like';
    final isDisliked = _myReaction == 'dislike';

    final authState = ref.watch(authStateProvider);
    final currentUser =
        authState is AuthStateAuthenticated ? authState.user : null;
    final isAuthor = currentUser != null && currentUser.userId == reply.userId;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          UserAvatar(
            avatarUrl: reply.userAvatarUrl,
            name: reply.userName,
            size: 26,
            isVerified: reply.isVerified,
            onTap: canNavigate ? () => widget.onOpenProfile(target) : null,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: GestureDetector(
                        onTap: canNavigate
                            ? () => widget.onOpenProfile(target)
                            : null,
                        child: Text(
                          reply.userName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: context.textPrimary,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    if (reply.isVerified) ...[
                      const SizedBox(width: 4),
                      const Icon(
                        Icons.verified,
                        size: 11,
                        color: AppColors.brandGold,
                      ),
                    ],
                    if (reply.isMember) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.brandOrange.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(5),
                        ),
                        child: const Text(
                          'Member',
                          style: TextStyle(
                            color: AppColors.brandOrange,
                            fontSize: 8.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(width: 6),
                    Text(
                      reply.timeAgo,
                      style: TextStyle(color: context.textDim, fontSize: 10.5),
                    ),
                  ],
                ),
                const SizedBox(height: 2),

                // Reply text with optional @mention highlight
                Text.rich(
                  TextSpan(
                    children: [
                      if (reply.parentUserName != null &&
                          reply.parentUserName!.isNotEmpty)
                        TextSpan(
                          text: '@${reply.parentUserName} ',
                          style: const TextStyle(
                            color: AppColors.brandOrange,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      TextSpan(
                        text: reply.text,
                        style: TextStyle(
                          color: context.textSecondary,
                          fontSize: 12.5,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 4),

                // Reply Action row
                Row(
                  children: [
                    InkWell(
                      onTap: () => _handleReaction('like'),
                      borderRadius: BorderRadius.circular(10),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 3,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              isLiked
                                  ? Icons.thumb_up_alt_rounded
                                  : Icons.thumb_up_alt_outlined,
                              size: 13.5,
                              color: isLiked
                                  ? AppColors.brandOrange
                                  : context.textDim,
                            ),
                            if (_likeCount > 0) ...[
                              const SizedBox(width: 3),
                              Text(
                                _formatCount(_likeCount),
                                style: TextStyle(
                                  color: isLiked
                                      ? AppColors.brandOrange
                                      : context.textDim,
                                  fontSize: 10.5,
                                  fontWeight: isLiked
                                      ? FontWeight.w700
                                      : FontWeight.normal,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    InkWell(
                      onTap: () => _handleReaction('dislike'),
                      borderRadius: BorderRadius.circular(10),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 3,
                        ),
                        child: Icon(
                          isDisliked
                              ? Icons.thumb_down_alt_rounded
                              : Icons.thumb_down_alt_outlined,
                          size: 13.5,
                          color: isDisliked
                              ? AppColors.brandOrange
                              : context.textDim,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    InkWell(
                      onTap: () => widget.onReplyTap(
                        reply.userId,
                        reply.userName,
                      ),
                      borderRadius: BorderRadius.circular(10),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 3,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.reply_rounded,
                              size: 14,
                              color: context.textDim,
                            ),
                            const SizedBox(width: 3),
                            Text(
                              'Reply',
                              style: TextStyle(
                                color: context.textDim,
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const Spacer(),
                    if (isAuthor)
                      IconButton(
                        icon: Icon(
                          Icons.delete_outline_rounded,
                          size: 14.5,
                          color: context.textDim.withValues(alpha: 0.7),
                        ),
                        tooltip: 'Delete',
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: _handleDeleteReply,
                      )
                    else
                      IconButton(
                        icon: Icon(
                          Icons.flag_outlined,
                          size: 13.5,
                          color: context.textDim.withValues(alpha: 0.6),
                        ),
                        tooltip: 'Report',
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: () => showCommentReportSheet(
                          context,
                          videoId: widget.videoId,
                          comment: reply,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
