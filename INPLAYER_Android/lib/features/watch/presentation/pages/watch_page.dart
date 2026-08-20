import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logger/logger.dart';
import 'package:share_plus/share_plus.dart';
import 'package:video_player/video_player.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/video_service.dart';
import '../../../../services/like_service.dart';
import '../../../../services/watchlist_service.dart';
import '../../../../services/comment_service.dart';
import '../../../../services/channel_service.dart';
import '../../../../models/video.dart';
import '../../../../models/comment.dart';
import '../../../../services/premium_service.dart';

class WatchPage extends ConsumerStatefulWidget {
  final String videoId;

  const WatchPage({super.key, required this.videoId});

  @override
  ConsumerState<WatchPage> createState() => _WatchPageState();
}

class _WatchPageState extends ConsumerState<WatchPage> {
  final _logger = Logger();
  final _commentController = TextEditingController();

  VideoPlayerController? _videoController;
  bool _isInitialized = false;
  bool _isLoading = true;
  Video? _video;
  bool _descExpanded = false;
  List<Video> _recommendedVideos = [];

  // Likes
  int _likeCount = 0;
  int _dislikeCount = 0;
  String? _myReaction;
  bool _likeBusy = false;

  // Watchlist ("Save")
  bool _isSaved = false;
  bool _watchlistBusy = false;

  // Subscribe (uploader row)
  bool _isSubscribed = false;
  int? _subscriberCount;
  bool _subscribeBusy = false;

  // Comments
  List<Comment> _comments = [];
  bool _commentsLoading = false;
  bool _commentsExpanded = false;
  bool _postingComment = false;

  @override
  void initState() {
    super.initState();
    _loadVideo();
  }

  @override
  void dispose() {
    _videoController?.dispose();
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _loadVideo() async {
    try {
      final videoService = ref.read(videoServiceProvider);
      final video = await videoService.getVideoById(widget.videoId);

      if (video == null) {
        if (mounted) setState(() => _isLoading = false);
        return;
      }

      if (video.muxPlaybackId != null && video.muxPlaybackId!.isNotEmpty) {
        final premiumService = ref.read(premiumServiceProvider);
        final maxRes = await premiumService.getMaxResolution();
        final videoUrl = 'https://stream.mux.com/${video.muxPlaybackId}.m3u8?max_resolution=$maxRes';
        _videoController = VideoPlayerController.networkUrl(Uri.parse(videoUrl));

        try {
          await _videoController!.initialize();
          _isInitialized = true;
          _videoController!.play();
        } catch (e) {
          _logger.e('Error initializing video player: $e');
          _isInitialized = false;
        }
      }

      final recommended = await videoService.getVideos();

      if (!mounted) return;

      setState(() {
        _video = video;
        _recommendedVideos =
            recommended.where((v) => v.videoId != widget.videoId).toList();
        _isLoading = false;
      });

      _loadEngagementState(video);
    } catch (e) {
      _logger.e('Error loading video: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _loadEngagementState(Video video) {
    _loadLikeStatus(video.videoId);
    _loadWatchlistStatus(video.videoId);
    _loadComments(video.videoId);

    if (video.uploaderId != null && video.uploaderId!.isNotEmpty) {
      _loadSubscriptionStatus(video.uploaderId!);
    }
  }

  Future<void> _loadLikeStatus(String videoId) async {
    final status = await ref.read(likeServiceProvider).getStatus(videoId);
    if (!mounted) return;
    setState(() {
      _likeCount = (status['likeCount'] as num?)?.toInt() ?? 0;
      _dislikeCount = (status['dislikeCount'] as num?)?.toInt() ?? 0;
      _myReaction = status['myReaction'] as String?;
    });
  }

  Future<void> _loadWatchlistStatus(String videoId) async {
    final saved = await ref.read(watchlistServiceProvider).isSaved(videoId);
    if (!mounted) return;
    setState(() => _isSaved = saved);
  }

  Future<void> _loadComments(String videoId) async {
    setState(() => _commentsLoading = true);
    final comments = await ref.read(commentServiceProvider).getComments(videoId);
    if (!mounted) return;
    setState(() {
      _comments = comments;
      _commentsLoading = false;
    });
  }

  Future<void> _loadSubscriptionStatus(String creatorId) async {
    final status =
        await ref.read(channelServiceProvider).getSubscriptionStatus(creatorId);
    if (!mounted || status == null) return;
    setState(() {
      _isSubscribed = status['isSubscribed'] == true;
      _subscriberCount = (status['subscriberCount'] as num?)?.toInt();
    });
  }

  Future<void> _toggleReaction(String action) async {
    final video = _video;
    if (video == null || _likeBusy) return;

    final prevReaction = _myReaction;
    final prevLike = _likeCount;
    final prevDislike = _dislikeCount;
    final effective = prevReaction == action ? 'remove' : action;

    setState(() {
      _likeBusy = true;
      if (prevReaction == 'like' && _likeCount > 0) _likeCount--;
      if (prevReaction == 'dislike' && _dislikeCount > 0) _dislikeCount--;
      if (effective == 'like') _likeCount++;
      if (effective == 'dislike') _dislikeCount++;
      _myReaction = effective == 'remove' ? null : effective;
    });

    final ok = await ref.read(likeServiceProvider).react(video.videoId, effective);

    if (!mounted) return;

    if (!ok) {
      setState(() {
        _myReaction = prevReaction;
        _likeCount = prevLike;
        _dislikeCount = prevDislike;
      });
      _showSnack('Sign in to react to videos.');
    }

    setState(() => _likeBusy = false);
  }

  Future<void> _toggleWatchlist() async {
    final video = _video;
    if (video == null || _watchlistBusy) return;

    final prev = _isSaved;
    setState(() {
      _watchlistBusy = true;
      _isSaved = !prev;
    });

    final service = ref.read(watchlistServiceProvider);
    final ok = prev
        ? await service.remove(video.videoId)
        : await service.add(video.videoId);

    if (!mounted) return;

    if (!ok) {
      setState(() => _isSaved = prev);
      _showSnack(prev ? "Couldn't remove from Watch Later." : 'Sign in to save videos.');
    } else {
      _showSnack(_isSaved ? 'Saved to Watch Later' : 'Removed from Watch Later');
    }

    setState(() => _watchlistBusy = false);
  }

  void _share() {
    final video = _video;
    if (video == null) return;
    final url = 'https://inplayer.in/watch/${video.videoId}';
    // share_plus ^7.x's API: static Share.share(text, subject: ...).
    Share.share('${video.title}\n$url', subject: video.title);
  }

  void _downloadNotAvailable() {
    _showSnack("Downloads aren't available yet.");
  }

  Future<void> _toggleSubscribe() async {
    final video = _video;
    if (video == null || video.uploaderId == null || video.uploaderId!.isEmpty) {
      return;
    }
    if (_subscribeBusy) return;

    final wasSubscribed = _isSubscribed;
    setState(() {
      _subscribeBusy = true;
      _isSubscribed = !wasSubscribed;
      _subscriberCount = (_subscriberCount ?? 0) + (wasSubscribed ? -1 : 1);
    });

    final service = ref.read(channelServiceProvider);
    final ok = wasSubscribed
        ? await service.unsubscribeFromChannel(video.uploaderId!)
        : await service.subscribeToChannel(video.uploaderId!);

    if (!mounted) return;

    if (!ok) {
      setState(() {
        _isSubscribed = wasSubscribed;
        _subscriberCount = (_subscriberCount ?? 0) + (wasSubscribed ? 1 : -1);
      });
      _showSnack('Sign in to subscribe.');
    }

    setState(() => _subscribeBusy = false);
  }

  Future<void> _postComment() async {
    final video = _video;
    final text = _commentController.text.trim();
    if (video == null || text.isEmpty || _postingComment) return;

    setState(() => _postingComment = true);

    final result =
        await ref.read(commentServiceProvider).postComment(video.videoId, text);

    if (!mounted) return;
    setState(() => _postingComment = false);

    if (result.requiresSignIn) {
      _showSnack('Sign in to comment.');
      return;
    }

    if (result.flagged) {
      _commentController.clear();
      _showSnack('Your comment was submitted for review.');
      return;
    }

    if (result.success) {
      _commentController.clear();
      setState(() => _comments = [result.comment!, ..._comments]);
    } else {
      _showSnack(result.error ?? "Couldn't post your comment.");
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.surfaceDark),
    );
  }

  String _formatCount(int count) {
    if (count >= 1000000) return '${(count / 1000000).toStringAsFixed(1)}M';
    if (count >= 1000) return '${(count / 1000).toStringAsFixed(1)}K';
    return count.toString();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: Column(
        children: [
          // Video Player
          AspectRatio(
            aspectRatio: 16 / 9,
            child: _isLoading
                ? Container(
                    color: Colors.black,
                    child: const Center(
                      child: CircularProgressIndicator(
                        color: AppColors.brandOrange,
                      ),
                    ),
                  )
                : _isInitialized && _videoController != null
                ? Stack(
                    alignment: Alignment.center,
                    children: [
                      VideoPlayer(_videoController!),
                      _buildVideoControls(),
                    ],
                  )
                : Container(
                    color: Colors.black,
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.error_outline,
                            size: 64,
                            color: Colors.white,
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'Video not available',
                            style: TextStyle(color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  ),
          ),
          // Video Info
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: _video != null
                  ? _buildVideoInfo(_video!)
                  : _buildPlaceholderInfo(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVideoControls() {
    return GestureDetector(
      onTap: () {
        setState(() {
          if (_videoController!.value.isPlaying) {
            _videoController!.pause();
          } else {
            _videoController!.play();
          }
        });
      },
      child: Container(
        color: Colors.transparent,
        child: Center(
          child: Icon(
            _videoController!.value.isPlaying ? Icons.pause : Icons.play_arrow,
            size: 64,
            color: Colors.white.withValues(alpha: 0.8),
          ),
        ),
      ),
    );
  }

  Widget _buildVideoInfo(Video video) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          video.title,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimaryDark,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '${video.views} • ${video.uploaded}',
          style: const TextStyle(
            color: AppColors.textSecondaryDark,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: 16),
        _buildActionBar(),
        const SizedBox(height: 16),
        Row(
          children: [
            GestureDetector(
              onTap: video.uploaderUsername == null
                  ? null
                  : () => context.push('/channel/${video.uploaderUsername}'),
              child: CircleAvatar(
                radius: 20,
                // smartImageProvider handles both normal https:// avatar URLs
                // and the inline data:image/...;base64 URIs the backend uses
                // for some custom thumbnails/avatars — plain NetworkImage
                // throws "No host specified in URI" on the latter, which is
                // what was crashing/blanking this avatar.
                backgroundImage: smartImageProvider(video.avatar),
                child: smartImageProvider(video.avatar) == null
                    ? const Icon(Icons.person, size: 20)
                    : null,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: GestureDetector(
                onTap: video.uploaderUsername == null
                    ? null
                    : () => context.push('/channel/${video.uploaderUsername}'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      video.creator,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimaryDark,
                      ),
                    ),
                    if (video.uploaderUsername != null)
                      Text(
                        _subscriberCount != null
                            ? '@${video.uploaderUsername} • ${_formatCount(_subscriberCount!)} subscribers'
                            : '@${video.uploaderUsername}',
                        style: const TextStyle(
                          color: AppColors.textSecondaryDark,
                          fontSize: 12,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (video.uploaderId != null && video.uploaderId!.isNotEmpty)
              ElevatedButton(
                onPressed: _subscribeBusy ? null : _toggleSubscribe,
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(96, 36),
                  elevation: 0,
                  backgroundColor:
                      _isSubscribed ? AppColors.surfaceDark : AppColors.brandOrange,
                  foregroundColor:
                      _isSubscribed ? AppColors.textPrimaryDark : Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: _isSubscribed
                        ? BorderSide(color: Colors.white.withValues(alpha: 0.08))
                        : BorderSide.none,
                  ),
                ),
                child: _subscribeBusy
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation(Colors.white),
                        ),
                      )
                    : Text(_isSubscribed ? 'Subscribed' : 'Subscribe'),
              ),
          ],
        ),
        const SizedBox(height: 16),
        if (video.description != null && video.description!.isNotEmpty)
          _buildDescriptionBox(video),
        const SizedBox(height: 16),
        _buildCommentsSection(),
        const SizedBox(height: 24),
        _buildRecommendedVideos(),
      ],
    );
  }

  Widget _buildActionBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildActionItem(
            icon: _myReaction == 'like'
                ? Icons.thumb_up_alt
                : Icons.thumb_up_alt_outlined,
            label: _likeCount > 0 ? _formatCount(_likeCount) : 'Like',
            active: _myReaction == 'like',
            onTap: () => _toggleReaction('like'),
          ),
          _buildActionItem(
            icon: Icons.reply_outlined,
            label: 'Share',
            onTap: _share,
          ),
          _buildActionItem(
            icon: Icons.download_outlined,
            label: 'Download',
            onTap: _downloadNotAvailable,
          ),
          _buildActionItem(
            icon: _isSaved ? Icons.bookmark : Icons.bookmark_outline,
            label: _isSaved ? 'Saved' : 'Save',
            active: _isSaved,
            onTap: _toggleWatchlist,
          ),
        ],
      ),
    );
  }

  Widget _buildActionItem({
    required IconData icon,
    required String label,
    bool active = false,
    VoidCallback? onTap,
  }) {
    final color = active ? AppColors.brandOrange : Colors.white;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Column(
            children: [
              Icon(icon, color: color, size: 24),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 12,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w400,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDescriptionBox(Video video) {
    return GestureDetector(
      onTap: () {
        setState(() {
          _descExpanded = !_descExpanded;
        });
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              video.description!,
              maxLines: _descExpanded ? null : 2,
              overflow: _descExpanded ? null : TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.textSecondaryDark,
                fontSize: 14,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _descExpanded ? 'Show less' : 'Show more',
              style: const TextStyle(
                color: AppColors.brandOrange,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCommentsSection() {
    final isSignedIn = ref.watch(authStateProvider) is AuthStateAuthenticated;
    final visibleComments =
        _commentsExpanded ? _comments : _comments.take(3).toList();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Comments',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              const SizedBox(width: 8),
              if (_commentsLoading)
                const SizedBox(
                  width: 12,
                  height: 12,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation(AppColors.brandOrange),
                  ),
                )
              else
                Text(
                  _formatCount(_comments.length),
                  style: const TextStyle(
                    color: AppColors.textSecondaryDark,
                    fontSize: 14,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const CircleAvatar(
                radius: 12,
                backgroundColor: AppColors.surfaceDark,
                child: Icon(Icons.person, size: 16, color: AppColors.textSecondaryDark),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _commentController,
                  enabled: !_postingComment,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  minLines: 1,
                  maxLines: 4,
                  onSubmitted: (_) => _postComment(),
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: isSignedIn ? 'Add a comment...' : 'Sign in to comment',
                    hintStyle: const TextStyle(
                      color: AppColors.textSecondaryDark,
                      fontSize: 13,
                    ),
                    filled: true,
                    fillColor: Colors.white.withValues(alpha: 0.05),
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    suffixIcon: _postingComment
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor:
                                    AlwaysStoppedAnimation(AppColors.brandOrange),
                              ),
                            ),
                          )
                        : IconButton(
                            icon: const Icon(Icons.send,
                                size: 18, color: AppColors.brandOrange),
                            onPressed: _postComment,
                          ),
                  ),
                ),
              ),
            ],
          ),
          if (visibleComments.isNotEmpty) ...[
            const SizedBox(height: 16),
            ...visibleComments.map(_buildCommentTile),
          ],
          if (!_commentsExpanded && _comments.length > 3)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: TextButton(
                onPressed: () => setState(() => _commentsExpanded = true),
                child: Text('View all ${_comments.length} comments',
                    style: const TextStyle(color: AppColors.brandOrange)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildCommentTile(Comment comment) {
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 14,
            backgroundColor: AppColors.surfaceDark,
            backgroundImage: comment.userAvatarUrl != null
                ? smartImageProvider(comment.userAvatarUrl!)
                : null,
            child: comment.userAvatarUrl == null ||
                    smartImageProvider(comment.userAvatarUrl!) == null
                ? const Icon(Icons.person, size: 15, color: AppColors.textSecondaryDark)
                : null,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        comment.userName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textPrimaryDark,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (comment.isVerified) ...[
                      const SizedBox(width: 4),
                      const Icon(Icons.verified, size: 12, color: AppColors.brandGold),
                    ],
                    if (comment.isMember) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
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
                      style: const TextStyle(
                        color: AppColors.textSecondaryDark,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  comment.text,
                  style: const TextStyle(
                    color: AppColors.textSecondaryDark,
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecommendedVideos() {
    if (_recommendedVideos.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 4,
              height: 20,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.brandOrange, AppColors.brandGold],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'Up Next',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _recommendedVideos.length > 5 ? 5 : _recommendedVideos.length,
          separatorBuilder: (context, index) => const SizedBox(height: 16),
          itemBuilder: (context, index) {
            final rec = _recommendedVideos[index];
            return GestureDetector(
              onTap: () {
                context.pushReplacement('/watch/${rec.videoId}');
              },
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 140,
                    height: 80,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceDark,
                      borderRadius: BorderRadius.circular(12),
                      image: smartImageProvider(rec.thumbnail) != null
                          ? DecorationImage(
                              image: smartImageProvider(rec.thumbnail)!,
                              fit: BoxFit.cover,
                            )
                          : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          rec.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          rec.creator,
                          style: const TextStyle(
                            color: AppColors.textSecondaryDark,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${rec.views} • ${rec.uploaded}',
                          style: const TextStyle(
                            color: AppColors.textSecondaryDark,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildPlaceholderInfo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Video Title',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimaryDark,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            const CircleAvatar(radius: 20),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Channel Name',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimaryDark,
                    ),
                  ),
                  Text(
                    '1M subscribers',
                    style: TextStyle(
                      color: AppColors.textSecondaryDark,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            ElevatedButton(
              onPressed: null,
              style: ElevatedButton.styleFrom(minimumSize: const Size(80, 36)),
              child: const Text('Subscribe'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        const Text(
          'This video could not be found.',
          style: TextStyle(color: AppColors.textSecondaryDark),
        ),
      ],
    );
  }
}
