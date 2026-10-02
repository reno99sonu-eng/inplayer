import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/utils/share_utils.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../models/film_series.dart';
import '../../../../models/film_episode.dart';
import '../../../../services/raftaar_films_service.dart';
import '../../../../services/like_service.dart';
import '../../../../services/watchlist_service.dart';
import '../../../../services/comment_service.dart';
import '../../../../services/video_service.dart';
import '../../../../models/comment.dart';
import '../../../../providers/auth_provider.dart';
import '../../../auth/presentation/widgets/auth_modals.dart';

class RaftaarFilmsPlayerPage extends ConsumerStatefulWidget {
  final String seriesId;
  final String episodeId;

  const RaftaarFilmsPlayerPage({
    super.key,
    required this.seriesId,
    required this.episodeId,
  });

  @override
  ConsumerState<RaftaarFilmsPlayerPage> createState() =>
      _RaftaarFilmsPlayerPageState();
}

class _RaftaarFilmsPlayerPageState
    extends ConsumerState<RaftaarFilmsPlayerPage> {
  FilmSeries? _series;
  List<FilmEpisode> _episodes = [];
  int _currentIndex = 0;
  bool _isLoading = true;
  late PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _loadSeriesAndEpisodes();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _loadSeriesAndEpisodes() async {
    setState(() => _isLoading = true);
    final service = ref.read(raftaarFilmsServiceProvider);

    try {
      final detail = await service.getSeriesDetail(widget.seriesId);
      final foundIndex = detail?.episodes.indexWhere(
        (ep) => ep.videoId == widget.episodeId,
      );
      if (detail != null && foundIndex != null && foundIndex >= 0 && mounted) {
        _series = detail.series;
        _episodes = detail.episodes;
        _currentIndex = foundIndex;
        _pageController.dispose();
        _pageController = PageController(initialPage: _currentIndex);
      } else if (mounted) {
        // The series ID on older links can be stale even while the episode
        // still exists. Resolve the video directly instead of starting some
        // other episode from index zero.
        final episode = await ref
            .read(videoServiceProvider)
            .getVideoById(widget.episodeId);
        if (episode != null && mounted) {
          context.go('/watch/${Uri.encodeComponent(widget.episodeId)}?direct=1');
          return;
        }
      }
    } catch (_) {}

    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  void _onEpisodeChanged(int index) {
    if (index >= 0 && index < _episodes.length) {
      setState(() => _currentIndex = index);
    }
  }

  void _showEpisodeSelector() {
    if (_series == null) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF16161E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'All Episodes (${_episodes.length})',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white70),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
              const Divider(color: Colors.white12),
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: _episodes.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 8),
                  itemBuilder: (context, idx) {
                    final ep = _episodes[idx];
                    final isCurrent = idx == _currentIndex;

                    return ListTile(
                      onTap: () {
                        Navigator.pop(context);
                        _pageController.jumpToPage(idx);
                      },
                      tileColor: isCurrent
                          ? const Color(0xFFFF7A18).withValues(alpha: 0.15)
                          : Colors.white.withValues(alpha: 0.04),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(
                          color: isCurrent
                              ? const Color(0xFFFF7A18)
                              : Colors.white.withValues(alpha: 0.06),
                        ),
                      ),
                      leading: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: isCurrent ? const Color(0xFFFF7A18) : Colors.black45,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Center(
                          child: Text(
                            '${ep.episodeNumber}',
                            style: TextStyle(
                              color: isCurrent ? Colors.white : Colors.white70,
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                            ),
                          ),
                        ),
                      ),
                      title: Text(
                        ep.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isCurrent ? const Color(0xFFFF9A00) : Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                      subtitle: Text(
                        '${ep.views} views',
                        style: const TextStyle(color: Colors.white54, fontSize: 12),
                      ),
                      trailing: isCurrent
                          ? const Icon(Icons.play_circle_fill, color: Color(0xFFFF7A18))
                          : null,
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.brandOrange),
        ),
      );
    }

    if (_episodes.isEmpty || _series == null) {
      return Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
            onPressed: () => context.pop(),
          ),
        ),
        body: const Center(
          child: Text(
            'No episodes available in this series.',
            style: TextStyle(color: Colors.white70, fontSize: 15),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: PageView.builder(
        controller: _pageController,
        scrollDirection: Axis.vertical,
        itemCount: _episodes.length,
        onPageChanged: _onEpisodeChanged,
        itemBuilder: (context, index) {
          final episode = _episodes[index];
          final isCurrent = index == _currentIndex;

          return _SingleFilmEpisodeView(
            key: ValueKey(episode.videoId),
            series: _series!,
            episode: episode,
            currentIndex: index,
            totalEpisodes: _episodes.length,
            isActive: isCurrent,
            onShowSelector: _showEpisodeSelector,
            onNextEpisode: index < _episodes.length - 1
                ? () => _pageController.nextPage(
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeInOut,
                    )
                : null,
            onPrevEpisode: index > 0
                ? () => _pageController.previousPage(
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeInOut,
                    )
                : null,
          );
        },
      ),
    );
  }
}

class _SingleFilmEpisodeView extends ConsumerStatefulWidget {
  final FilmSeries series;
  final FilmEpisode episode;
  final int currentIndex;
  final int totalEpisodes;
  final bool isActive;
  final VoidCallback onShowSelector;
  final VoidCallback? onNextEpisode;
  final VoidCallback? onPrevEpisode;

  const _SingleFilmEpisodeView({
    super.key,
    required this.series,
    required this.episode,
    required this.currentIndex,
    required this.totalEpisodes,
    required this.isActive,
    required this.onShowSelector,
    this.onNextEpisode,
    this.onPrevEpisode,
  });

  @override
  ConsumerState<_SingleFilmEpisodeView> createState() =>
      _SingleFilmEpisodeViewState();
}

class _SingleFilmEpisodeViewState
    extends ConsumerState<_SingleFilmEpisodeView> {
  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _isPlaying = true;
  bool _isLiked = false;
  int _likeCount = 0;
  bool _isSaved = false;
  bool _isFollowing = false;

  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _isDraggingSlider = false;
  double? _sliderDragValue;
  bool _hasRecordedView = false;

  String? _seekIndicatorText;
  bool _seekIndicatorForward = true;
  Timer? _seekIndicatorTimer;

  void _seekBy(int seconds) {
    if (_controller == null || !_isInitialized) return;
    final current = _controller!.value.position;
    final total = _controller!.value.duration;
    final target = current + Duration(seconds: seconds);
    final clamped = target < Duration.zero
        ? Duration.zero
        : (target > total ? total : target);
    _controller!.seekTo(clamped);

    _seekIndicatorTimer?.cancel();
    setState(() {
      _position = clamped;
      _seekIndicatorText = seconds > 0 ? '+${seconds}s' : '${seconds}s';
      _seekIndicatorForward = seconds > 0;
    });
    _seekIndicatorTimer = Timer(const Duration(milliseconds: 750), () {
      if (mounted) {
        setState(() {
          _seekIndicatorText = null;
        });
      }
    });
  }

  @override
  void initState() {
    super.initState();
    _likeCount = widget.episode.likes;
    if (widget.isActive) {
      _initPlayer();
      _fetchInitialState();
    }
  }

  @override
  void didUpdateWidget(covariant _SingleFilmEpisodeView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive != oldWidget.isActive) {
      if (widget.isActive) {
        if (_controller == null) {
          _initPlayer();
        } else {
          _controller?.play();
          setState(() => _isPlaying = true);
        }
      } else {
        _controller?.pause();
        setState(() => _isPlaying = false);
      }
    }
  }

  Future<void> _initPlayer() async {
    final streamUrl = widget.episode.streamUrl;
    if (streamUrl == null || streamUrl.isEmpty) return;

    try {
      _controller = VideoPlayerController.networkUrl(Uri.parse(streamUrl));
      await _controller!.initialize();
      _controller!.setLooping(false);
      _controller!.play();

      _controller!.addListener(_videoListener);

      if (!_hasRecordedView) {
        _hasRecordedView = true;
        ref.read(videoServiceProvider).recordView(widget.episode.videoId);
      }

      if (mounted) {
        setState(() {
          _isInitialized = true;
          _isPlaying = true;
          _duration = _controller!.value.duration;
        });
      }
    } catch (_) {}
  }

  void _videoListener() {
    if (!mounted || _controller == null) return;
    if (_isDraggingSlider) return;
    final pos = _controller!.value.position;
    final dur = _controller!.value.duration;

    if (pos != _position || dur != _duration) {
      setState(() {
        _position = pos;
        _duration = dur;
      });
    }

    if (_controller!.value.isCompleted && widget.onNextEpisode != null) {
      widget.onNextEpisode!();
    }
  }

  Future<void> _fetchInitialState() async {
    try {
      final likeStatus =
          await ref.read(likeServiceProvider).getStatus(widget.episode.videoId);
      final isSub = await ref
          .read(raftaarFilmsServiceProvider)
          .isSubscribed(widget.series.seriesId);
      final isSaved = await ref
          .read(watchlistServiceProvider)
          .isSaved(widget.episode.videoId);

      if (mounted) {
        setState(() {
          _isLiked = likeStatus['myReaction'] == 'like';
          _likeCount = (likeStatus['likeCount'] as num?)?.toInt() ?? widget.episode.likes;
          _isFollowing = isSub;
          _isSaved = isSaved;
        });
      }
    } catch (_) {}
  }

  void _togglePlayPause() {
    if (_controller == null) return;
    if (_controller!.value.isPlaying) {
      _controller!.pause();
      setState(() => _isPlaying = false);
    } else {
      _controller!.play();
      setState(() => _isPlaying = true);
    }
  }

  Future<void> _toggleLike() async {
    final nextLiked = !_isLiked;
    setState(() {
      _isLiked = nextLiked;
      _likeCount += nextLiked ? 1 : -1;
    });

    try {
      await ref.read(likeServiceProvider).react(
            widget.episode.videoId,
            nextLiked ? 'like' : 'remove',
            seriesId: widget.series.seriesId,
          );
    } catch (_) {}
  }

  Future<void> _toggleSave() async {
    final nextSaved = !_isSaved;
    setState(() => _isSaved = nextSaved);
    try {
      if (nextSaved) {
        await ref.read(watchlistServiceProvider).add(widget.episode.videoId);
      } else {
        await ref.read(watchlistServiceProvider).remove(widget.episode.videoId);
      }
    } catch (_) {}
  }

  Future<void> _toggleFollow() async {
    final nextFollowing = !_isFollowing;
    setState(() => _isFollowing = nextFollowing);
    await ref
        .read(raftaarFilmsServiceProvider)
        .toggleSubscribe(widget.series.seriesId, nextFollowing);
  }

  Future<void> _shareEpisode() async {
    await shareContentLink(
      videoId: widget.episode.videoId,
      title: '${widget.series.title} — Ep ${widget.episode.episodeNumber}',
    );
  }

  void _openComments() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF16161E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return _FilmCommentsSheet(videoId: widget.episode.videoId);
      },
    );
  }

  String _formatTime(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _seekIndicatorTimer?.cancel();
    _controller?.removeListener(_videoListener);
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final currentUser = authState is AuthStateAuthenticated ? authState.user : null;
    final cleanHandle = widget.series.creatorHandle.replaceAll('@', '').trim();
    final isOwner = currentUser != null &&
        (currentUser.userId == widget.series.creatorId ||
         (currentUser.handle != null && currentUser.handle!.replaceAll('@', '').trim().toLowerCase() == cleanHandle.toLowerCase()) ||
         currentUser.username.replaceAll('@', '').trim().toLowerCase() == cleanHandle.toLowerCase());

    final thumb = widget.episode.thumbnailUrl.isNotEmpty
        ? widget.episode.thumbnailUrl
        : widget.series.posterUrl;

    return Stack(
      fit: StackFit.expand,
      children: [
        // Video or Thumbnail Background
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onDoubleTapDown: (details) {
            final screenWidth = MediaQuery.of(context).size.width;
            final isRight = details.localPosition.dx >= screenWidth / 2;
            _seekBy(isRight ? 10 : -10);
          },
          onDoubleTap: () {},
          onTap: _togglePlayPause,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (_isInitialized && _controller != null)
                Center(
                  child: AspectRatio(
                    aspectRatio: _controller!.value.aspectRatio > 0
                        ? _controller!.value.aspectRatio
                        : 9 / 16,
                    child: VideoPlayer(_controller!),
                  ),
                )
              else if (thumb.isNotEmpty)
                SafeAppImage(
                  imageUrl: thumb,
                  fit: BoxFit.cover,
                  placeholder: (context, url) => Container(color: Colors.black),
                  errorWidget: (context, url, error) => Container(color: Colors.black),
                )
              else
                Container(color: Colors.black),

              // Play/Pause Tap Indicator
              if (!_isPlaying && _isInitialized)
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.play_arrow_rounded,
                      color: Colors.white,
                      size: 48,
                    ),
                  ),
                ),

              // Double-Tap Seek Indicator (+10s or -10s)
              if (_seekIndicatorText != null)
                Align(
                  alignment: _seekIndicatorForward
                      ? const Alignment(0.65, 0.0)
                      : const Alignment(-0.65, 0.0),
                  child: Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.75),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: const Color(0xFFFF7A18).withValues(alpha: 0.7),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFFF7A18).withValues(alpha: 0.35),
                          blurRadius: 20,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _seekIndicatorForward
                              ? Icons.fast_forward_rounded
                              : Icons.fast_rewind_rounded,
                          color: const Color(0xFFFF9A00),
                          size: 32,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _seekIndicatorText!,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),

        // Gradient Vignette for readability
        IgnorePointer(
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Colors.black.withValues(alpha: 0.65),
                  Colors.transparent,
                  Colors.transparent,
                  Colors.black.withValues(alpha: 0.85),
                ],
                stops: const [0.0, 0.20, 0.65, 1.0],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
        ),

        // Top Navigation & Episode Dropdown
        SafeArea(
          child: Align(
            alignment: Alignment.topCenter,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(
                      Icons.arrow_back_ios_new_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                    onPressed: () {
                      if (context.canPop()) {
                        context.pop();
                      } else {
                        context.go('/raftaar-films/${widget.series.seriesId}');
                      }
                    },
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      'Series · ${widget.series.title}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        shadows: [Shadow(color: Colors.black, blurRadius: 4)],
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: widget.onShowSelector,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.25),
                          width: 0.5,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Ep ${widget.episode.episodeNumber}/${widget.totalEpisodes}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.keyboard_arrow_down_rounded,
                            color: Colors.white,
                            size: 16,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        // Right Action Rail (Like, Comment, Share, Save)
        Positioned(
          right: 12,
          bottom: 110,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Like Button
              _buildRailButton(
                icon: _isLiked ? Icons.favorite : Icons.favorite_border,
                label: '$_likeCount',
                color: _isLiked ? const Color(0xFFFF2A54) : Colors.white,
                onTap: _toggleLike,
              ),
              const SizedBox(height: 18),

              // Comment Button
              _buildRailButton(
                icon: Icons.chat_bubble_outline_rounded,
                label: 'Comments',
                color: Colors.white,
                onTap: _openComments,
              ),
              const SizedBox(height: 18),

              // Share Button
              _buildRailButton(
                icon: Icons.share_outlined,
                label: 'Share',
                color: Colors.white,
                onTap: _shareEpisode,
              ),
              const SizedBox(height: 18),

              // Save / Bookmark Button
              _buildRailButton(
                icon: _isSaved ? Icons.bookmark : Icons.bookmark_border_rounded,
                label: _isSaved ? 'Saved' : 'Save',
                color: _isSaved ? const Color(0xFFFF9A00) : Colors.white,
                onTap: _toggleSave,
              ),
            ],
          ),
        ),

        // Bottom Left Info & Controls
        Positioned(
          left: 16,
          right: 76,
          bottom: 40,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Creator Row with Follow Button
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () {
                        if (isOwner) {
                          context.push('/my-videos');
                        } else {
                          final handle = cleanHandle.isNotEmpty ? cleanHandle : widget.series.creatorId;
                          if (handle.isNotEmpty) {
                            context.push('/channel/$handle');
                          }
                        }
                      },
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 16,
                            backgroundColor: Colors.white24,
                            backgroundImage: widget.series.creatorAvatarUrl.isNotEmpty
                                ? smartImageProvider(
                                    widget.series.creatorAvatarUrl,
                                  )
                                : null,
                            child: widget.series.creatorAvatarUrl.isEmpty
                                ? const Icon(Icons.person, size: 16, color: Colors.white)
                                : null,
                          ),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              widget.series.creatorName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                                shadows: [Shadow(color: Colors.black, blurRadius: 4)],
                              ),
                            ),
                          ),
                          if (isOwner) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFF7A18).withValues(alpha: 0.25),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(
                                  color: const Color(0xFFFF7A18).withValues(alpha: 0.5),
                                  width: 0.5,
                                ),
                              ),
                              child: const Text(
                                'You',
                                style: TextStyle(
                                  color: Color(0xFFFF7A18),
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  if (!isOwner) ...[
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: _toggleFollow,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: _isFollowing
                              ? Colors.white.withValues(alpha: 0.15)
                              : const Color(0xFFFF7A18),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(
                          _isFollowing ? 'In-Family' : '+ In-Family',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 8),

              // Episode Title & Badge
              Text(
                'Ep ${widget.episode.episodeNumber}: ${widget.episode.title}',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                  shadows: [Shadow(color: Colors.black, blurRadius: 4)],
                ),
              ),

              const SizedBox(height: 10),

              // Scrubbable Progress Bar
              if (_isInitialized)
                Row(
                  children: [
                    Text(
                      _isDraggingSlider && _sliderDragValue != null
                          ? _formatTime(Duration(milliseconds: _sliderDragValue!.toInt()))
                          : _formatTime(_position),
                      style: const TextStyle(color: Colors.white70, fontSize: 10),
                    ),
                    Expanded(
                      child: SliderTheme(
                        data: SliderTheme.of(context).copyWith(
                          trackHeight: 3.0,
                          thumbShape: const RoundSliderThumbShape(
                            enabledThumbRadius: 6,
                          ),
                          overlayShape: const RoundSliderOverlayShape(
                            overlayRadius: 10,
                          ),
                          activeTrackColor: const Color(0xFFFF7A18),
                          inactiveTrackColor: Colors.white24,
                          thumbColor: const Color(0xFFFF9A00),
                        ),
                        child: Slider(
                          value: (_isDraggingSlider && _sliderDragValue != null
                                  ? _sliderDragValue!
                                  : _position.inMilliseconds.toDouble())
                              .clamp(
                                  0.0,
                                  _duration.inMilliseconds > 0
                                      ? _duration.inMilliseconds.toDouble()
                                      : 1.0),
                          min: 0.0,
                          max: _duration.inMilliseconds > 0
                              ? _duration.inMilliseconds.toDouble()
                              : 1.0,
                          onChangeStart: (val) {
                            setState(() {
                              _isDraggingSlider = true;
                              _sliderDragValue = val;
                            });
                          },
                          onChanged: (val) {
                            setState(() {
                              _sliderDragValue = val;
                            });
                          },
                          onChangeEnd: (val) {
                            final target = Duration(milliseconds: val.toInt());
                            _controller?.seekTo(target);
                            setState(() {
                              _isDraggingSlider = false;
                              _sliderDragValue = null;
                              _position = target;
                            });
                          },
                        ),
                      ),
                    ),
                    Text(
                      _formatTime(_duration),
                      style: const TextStyle(color: Colors.white70, fontSize: 10),
                    ),
                  ],
                ),
            ],
          ),
        ),

        // Floating Next/Prev episode buttons at bottom right
        Positioned(
          right: 12,
          bottom: 30,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.onPrevEpisode != null)
                IconButton(
                  icon: const Icon(
                    Icons.skip_previous_rounded,
                    color: Colors.white70,
                    size: 26,
                  ),
                  onPressed: widget.onPrevEpisode,
                ),
              if (widget.onNextEpisode != null)
                IconButton(
                  icon: const Icon(
                    Icons.skip_next_rounded,
                    color: Color(0xFFFF9A00),
                    size: 28,
                  ),
                  onPressed: widget.onNextEpisode,
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildRailButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.45),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              shadows: [Shadow(color: Colors.black, blurRadius: 4)],
            ),
          ),
        ],
      ),
    );
  }
}

class _FilmCommentsSheet extends ConsumerStatefulWidget {
  final String videoId;

  const _FilmCommentsSheet({required this.videoId});

  @override
  ConsumerState<_FilmCommentsSheet> createState() => _FilmCommentsSheetState();
}

class _FilmCommentsSheetState extends ConsumerState<_FilmCommentsSheet> {
  final TextEditingController _commentCtrl = TextEditingController();
  List<Comment> _comments = [];
  bool _isLoading = true;
  bool _isPosting = false;

  @override
  void initState() {
    super.initState();
    _fetchComments();
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchComments() async {
    setState(() => _isLoading = true);
    try {
      final list =
          await ref.read(commentServiceProvider).getComments(widget.videoId);
      if (mounted) {
        setState(() {
          _comments = list;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _postComment() async {
    final text = _commentCtrl.text.trim();
    if (text.isEmpty) return;

    final authState = ref.read(authStateProvider);
    if (authState is! AuthStateAuthenticated) {
      showSignInModal(context);
      return;
    }

    setState(() => _isPosting = true);
    try {
      final result = await ref
          .read(commentServiceProvider)
          .postComment(widget.videoId, text);
      if (result.comment != null && mounted) {
        _commentCtrl.clear();
        setState(() {
          _comments.insert(0, result.comment!);
        });
      }
    } catch (_) {}

    if (mounted) setState(() => _isPosting = false);
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.65,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollCtrl) {
        return Container(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: Column(
            children: [
              // Sheet Header
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 16, 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Comments (${_comments.length})',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white70),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
              const Divider(color: Colors.white12, height: 1),

              // Comments List
              Expanded(
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.brandOrange,
                        ),
                      )
                    : _comments.isEmpty
                        ? const Center(
                            child: Text(
                              'Be the first to comment!',
                              style: TextStyle(
                                color: Colors.white38,
                                fontSize: 14,
                              ),
                            ),
                          )
                        : ListView.separated(
                            controller: scrollCtrl,
                            padding: const EdgeInsets.all(16),
                            itemCount: _comments.length,
                            separatorBuilder: (context, index) =>
                                const SizedBox(height: 14),
                            itemBuilder: (context, idx) {
                              final c = _comments[idx];
                              return Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  CircleAvatar(
                                    radius: 16,
                                    backgroundColor: Colors.white12,
                                    backgroundImage:
                                        c.userAvatarUrl != null &&
                                                c.userAvatarUrl!.isNotEmpty
                                            ? smartImageProvider(
                                                c.userAvatarUrl!,
                                              )
                                            : null,
                                    child: c.userAvatarUrl == null ||
                                            c.userAvatarUrl!.isEmpty
                                        ? const Icon(
                                            Icons.person,
                                            size: 16,
                                            color: Colors.white70,
                                          )
                                        : null,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          c.userName,
                                          style: const TextStyle(
                                            color: Colors.white70,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          c.text,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 13,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
              ),

              // Input Bar
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                decoration: const BoxDecoration(
                  color: Color(0xFF0F0F13),
                  border: Border(top: BorderSide(color: Colors.white12)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _commentCtrl,
                        style: const TextStyle(color: Colors.white, fontSize: 14),
                        decoration: InputDecoration(
                          hintText: 'Add a comment...',
                          hintStyle: const TextStyle(
                            color: Colors.white38,
                            fontSize: 13,
                          ),
                          filled: true,
                          fillColor: Colors.white.withValues(alpha: 0.08),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 10,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(24),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: _isPosting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.brandOrange,
                              ),
                            )
                          : const Icon(
                              Icons.send_rounded,
                              color: AppColors.brandOrange,
                            ),
                      onPressed: _isPosting ? null : _postComment,
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
