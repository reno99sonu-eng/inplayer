import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../models/short.dart';
import '../../../../models/comment.dart';
import '../../../../services/video_service.dart';
import '../../../../services/premium_service.dart';
import '../../../../core/utils/playback_settings_store.dart';
import '../../../../services/like_service.dart';
import '../../../../services/watchlist_service.dart';
import '../../../../services/channel_service.dart';
import '../../../../services/comment_service.dart';
import '../../../../services/video_mini_player_service.dart';

class ShortPlayerWidget extends ConsumerStatefulWidget {
  final Short short;
  final bool isActive;

  /// Height, in logical pixels, of any app chrome overlapping the bottom of
  /// this card — in practice the home shell's bottom navigation bar, which
  /// floats over this page because HomePage's Scaffold sets
  /// `extendBody: true`.
  ///
  /// Every bottom-anchored overlay below (the right action rail, the
  /// channel/caption block, the gradient scrim) is offset by this. Without
  /// it those controls sit at bottom: 24–28 — directly underneath the nav
  /// bar — so the Save button and the channel row were being clipped off
  /// the bottom of the screen, which is what "cropped entirely from below"
  /// was describing. The video frame itself was never actually cropped;
  /// it was occluded.
  ///
  /// Defaults to 0 because the standalone pushed `/shorts` route has no
  /// bottom nav over it — only the tab inside HomePage passes a real value.
  final double bottomInset;

  /// Fired after this card has handed its player off to the floating mini
  /// window, so the feed can get out of the way — there is no point sitting
  /// on a full-screen shorts feed whose video is now playing in a corner.
  /// Null hides the minimize button entirely, the same on/off-by-presence
  /// pattern PlayerChrome uses for onMinimize and onPipTapped.
  final VoidCallback? onMinimized;

  const ShortPlayerWidget({
    super.key,
    required this.short,
    this.isActive = true,
    this.bottomInset = 0,
    this.onMinimized,
  });

  @override
  ConsumerState<ShortPlayerWidget> createState() => _ShortPlayerWidgetState();
}

class _ShortPlayerWidgetState extends ConsumerState<ShortPlayerWidget>
    with WidgetsBindingObserver {
  VideoPlayerController? _videoController;
  AudioPlayer? _audioPlayer;
  bool _isInitialized = false;
  bool _isPlaying = false;
  double _progress = 0.0;
  bool _showHeartBurst = false;

  // Live interaction state
  bool _isLiked = false;
  int _likeCount = 0;
  bool _isSaved = false;
  bool _isSubscribed = false;
  int _commentCount = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _parseInitialCounts();
    _initPlayer();
    _loadInteractionStatus();
  }

  void _parseInitialCounts() {
    // Parse likes string (e.g. "12 likes" -> 12)
    final likeMatch = RegExp(r'(\d+)').firstMatch(widget.short.likes);
    if (likeMatch != null) {
      _likeCount = int.tryParse(likeMatch.group(1)!) ?? 0;
    }
    final commentMatch = RegExp(r'(\d+)').firstMatch(widget.short.comments);
    if (commentMatch != null) {
      _commentCount = int.tryParse(commentMatch.group(1)!) ?? 0;
    }
  }

  Future<void> _loadInteractionStatus() async {
    if (widget.short.videoId.isEmpty) return;

    // Load like status
    try {
      final likeService = ref.read(likeServiceProvider);
      final status = await likeService.getStatus(widget.short.videoId);
      if (mounted) {
        setState(() {
          _isLiked = status['myReaction'] == 'like';
          if (status['likeCount'] != null && status['likeCount'] is int) {
            _likeCount = status['likeCount'] as int;
          }
        });
      }
    } catch (_) {}

    // Load watchlist status
    try {
      final watchlistService = ref.read(watchlistServiceProvider);
      final saved = await watchlistService.isSaved(widget.short.videoId);
      if (mounted) {
        setState(() => _isSaved = saved);
      }
    } catch (_) {}

    // Load subscription status
    if (widget.short.uploaderId != null && widget.short.uploaderId!.isNotEmpty) {
      try {
        final channelService = ref.read(channelServiceProvider);
        final sub = await channelService.getSubscriptionStatus(widget.short.uploaderId!);
        if (mounted && sub != null) {
          setState(() {
            _isSubscribed = sub['isSubscribed'] == true;
          });
        }
      } catch (_) {}
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden) {
      _pausePlayback();
    } else if (state == AppLifecycleState.resumed) {
      if (widget.isActive) {
        _resumePlayback();
      }
    }
  }

  @override
  void didUpdateWidget(covariant ShortPlayerWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isActive != widget.isActive) {
      if (!widget.isActive) {
        _pausePlayback();
      } else if (_videoController == null) {
        // Becoming active again with no controller means this card gave its
        // player away to the mini window (see _minimize) and the viewer has
        // now come back to the feed. Build a fresh one rather than sitting
        // on a dead poster forever.
        _initPlayer();
      } else {
        _resumePlayback();
      }
    }
  }

  /// Hand this card's player to the floating mini window and step aside.
  ///
  /// Ownership genuinely transfers: the refs are nulled rather than
  /// disposed, so this widget's own dispose() becomes a no-op for them and
  /// the mini player is left holding the only reference. The anonymous
  /// progress listener attached in _initPlayer already guards on
  /// `_videoController == null`, so it goes quiet on its own the moment
  /// that happens — no dangling callback into a card that no longer owns
  /// the player.
  ///
  /// The soundtrack AudioPlayer travels with it. A short with a picked
  /// soundtrack mutes its video and plays the track separately, so leaving
  /// the audio behind would mean silent video in the corner and music still
  /// coming from a page nobody is looking at.
  void _minimize() {
    final controller = _videoController;
    if (controller == null || !_isInitialized) return;

    ref.read(videoMiniPlayerServiceProvider).activateShort(
          controller: controller,
          soundtrack: _audioPlayer,
          short: widget.short,
        );

    setState(() {
      _videoController = null;
      _audioPlayer = null;
      // Falls the card back to its poster image instead of a black hole
      // where the video surface used to be.
      _isInitialized = false;
      _isPlaying = false;
    });

    widget.onMinimized?.call();
  }

  void _pausePlayback() {
    _videoController?.pause();
    _audioPlayer?.pause();
    if (mounted) {
      setState(() => _isPlaying = false);
    }
  }

  void _resumePlayback() {
    if (_isInitialized && _videoController != null) {
      _videoController?.play();
      _audioPlayer?.resume();
      if (mounted) {
        setState(() => _isPlaying = true);
      }
    }
  }

  Future<void> _initPlayer() async {
    try {
      String? videoUrl;
      final premiumService = ref.read(premiumServiceProvider);
      // Combines the viewer's real Premium tier with Settings > Playback >
      // "Shorts & mobile quality" — matches maxResolution={
      //   effectiveMaxResolution(premium.premium,
      //   preferredResolution(playback.mobileQuality)) } on the website's
      // own Shorts player (ShortsPageContent.tsx), not just the tier alone.
      final status = await premiumService.getStatus();
      final playbackSettings = await PlaybackSettingsStore.get();
      final maxRes = effectiveMaxResolution(status.maxResolution, playbackSettings.mobileQuality);

      if (widget.short.muxPlaybackId != null && widget.short.muxPlaybackId!.isNotEmpty) {
        videoUrl = 'https://stream.mux.com/${widget.short.muxPlaybackId}.m3u8?max_resolution=$maxRes';
      } else if (widget.short.videoId.isNotEmpty) {
        final videoService = ref.read(videoServiceProvider);
        final video = await videoService.getVideoById(widget.short.videoId);
        if (video != null && video.muxPlaybackId != null && video.muxPlaybackId!.isNotEmpty) {
          videoUrl = 'https://stream.mux.com/${video.muxPlaybackId}.m3u8?max_resolution=$maxRes';
        }
      }

      if (videoUrl != null && mounted) {
        _videoController = VideoPlayerController.networkUrl(Uri.parse(videoUrl));
        await _videoController!.initialize();
        _videoController!.setLooping(true);

        _videoController!.addListener(() {
          if (!mounted || _videoController == null) return;
          final duration = _videoController!.value.duration;
          final position = _videoController!.value.position;
          if (duration.inMilliseconds > 0) {
            final p = position.inMilliseconds / duration.inMilliseconds;
            if ((p - _progress).abs() > 0.01) {
              setState(() {
                _progress = p;
              });
            }
          }
        });

        // Soundtrack handling: if soundtrack is present, mute the video and loop the soundtrack
        if (widget.short.soundtrack != null && widget.short.soundtrack!.url.isNotEmpty) {
          _audioPlayer = AudioPlayer();
          await _audioPlayer!.setReleaseMode(ReleaseMode.loop);
          await _audioPlayer!.setSourceUrl(widget.short.soundtrack!.url);
          _videoController!.setVolume(0.0);
        } else {
          _videoController!.setVolume(1.0);
        }

        if (mounted) {
          setState(() {
            _isInitialized = true;
          });

          // Only start playing if this short is currently active
          if (widget.isActive) {
            _resumePlayback();
          } else {
            _pausePlayback();
          }
        }
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _videoController?.pause();
    _videoController?.dispose();
    _videoController = null;
    _audioPlayer?.stop();
    _audioPlayer?.dispose();
    _audioPlayer = null;
    super.dispose();
  }

  void _togglePlay() {
    if (_videoController == null || !_isInitialized) return;
    if (_videoController!.value.isPlaying) {
      _pausePlayback();
    } else {
      _resumePlayback();
    }
  }

  Future<void> _toggleLike() async {
    if (widget.short.videoId.isEmpty) return;
    final wasLiked = _isLiked;
    setState(() {
      _isLiked = !wasLiked;
      _likeCount += wasLiked ? -1 : 1;
      if (!_isLiked) {
        _showHeartBurst = false;
      } else {
        _showHeartBurst = true;
      }
    });

    if (_showHeartBurst) {
      Future.delayed(const Duration(milliseconds: 900), () {
        if (mounted) setState(() => _showHeartBurst = false);
      });
    }

    final likeService = ref.read(likeServiceProvider);
    final ok = await likeService.react(widget.short.videoId, wasLiked ? 'remove' : 'like');
    if (!ok && mounted) {
      setState(() {
        _isLiked = wasLiked;
        _likeCount += wasLiked ? 1 : -1;
      });
    }
  }

  Future<void> _toggleWatchlist() async {
    if (widget.short.videoId.isEmpty) return;
    final wasSaved = _isSaved;
    setState(() => _isSaved = !wasSaved);

    final service = ref.read(watchlistServiceProvider);
    final ok = wasSaved
        ? await service.remove(widget.short.videoId)
        : await service.add(widget.short.videoId);

    if (!ok && mounted) {
      setState(() => _isSaved = wasSaved);
    }
  }

  Future<void> _toggleSubscribe() async {
    final creatorId = widget.short.uploaderId;
    if (creatorId == null || creatorId.isEmpty) return;

    final wasSubscribed = _isSubscribed;
    setState(() => _isSubscribed = !wasSubscribed);

    final service = ref.read(channelServiceProvider);
    final ok = wasSubscribed
        ? await service.unsubscribeFromChannel(creatorId)
        : await service.subscribeToChannel(creatorId);

    if (!ok && mounted) {
      setState(() => _isSubscribed = wasSubscribed);
    }
  }

  void _shareShort() {
    // /shorts/{id} (not /watch/{id}) so the link lands on the scrolling
    // Shorts feed at this video instead of the raw watch page.
    final url = 'https://inplayer.in/shorts/${widget.short.videoId}';
    SharePlus.instance.share(ShareParams(text: '${widget.short.title}\n$url', subject: widget.short.title));
  }

  void _showCommentsModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _ShortCommentsSheet(
        videoId: widget.short.videoId,
        onCommentAdded: () {
          setState(() => _commentCount++);
        },
      ),
    );
  }

  List<InlineSpan> _buildCaptionSpans(String text) {
    final spans = <InlineSpan>[];
    final parts = text.split(RegExp(r'(\s+)'));
    for (final part in parts) {
      if (part.startsWith('#') && part.length > 1) {
        spans.add(TextSpan(
          text: '$part ',
          style: const TextStyle(
            color: Color(0xFF7DD3FC), // sky-300 matching web
            fontWeight: FontWeight.w700,
            fontSize: 14,
          ),
        ));
      } else {
        spans.add(TextSpan(
          text: '$part ',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ));
      }
    }
    return spans;
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // 1. Video or Poster Layer with Tap to Toggle / Double Tap to Like
        GestureDetector(
          onTap: _togglePlay,
          onDoubleTap: () {
            if (!_isLiked) _toggleLike();
          },
          child: _isInitialized && _videoController != null
              ? SizedBox.expand(
                  child: FittedBox(
                    fit: BoxFit.cover,
                    child: SizedBox(
                      width: _videoController!.value.size.width > 0
                          ? _videoController!.value.size.width
                          : 1080,
                      height: _videoController!.value.size.height > 0
                          ? _videoController!.value.size.height
                          : 1920,
                      child: VideoPlayer(_videoController!),
                    ),
                  ),
                )
              : _buildShortPoster(),
        ),

        // 2. Heart Burst on Double-Tap
        if (_showHeartBurst)
          Center(
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.0, end: 1.2),
              duration: const Duration(milliseconds: 400),
              builder: (context, val, child) {
                return Transform.scale(
                  scale: val,
                  child: const Icon(
                    Icons.favorite,
                    size: 110,
                    color: Color(0xFFF43F5E), // rose-500
                    shadows: [
                      Shadow(
                        color: Colors.black54,
                        blurRadius: 20,
                      ),
                    ],
                  ),
                );
              },
            ),
          ),

        // 3. Play/Pause central indicator when paused
        if (!_isPlaying && _isInitialized)
          Center(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.5),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white24, width: 1.5),
              ),
              child: const Icon(
                Icons.play_arrow,
                size: 48,
                color: Colors.white,
              ),
            ),
          ),

        // 4. Subtle Vignette / Gradient overlays
        // Stays pinned to the true bottom (no bottomInset) so the scrim
        // still runs behind the translucent nav bar rather than stopping
        // short of it and leaving a hard edge — but it grows by the same
        // amount so the fade still starts above the raised content.
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          height: 360 + widget.bottomInset,
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.90),
                  Colors.black.withValues(alpha: 0.50),
                  Colors.transparent,
                ],
                stops: const [0.0, 0.5, 1.0],
              ),
            ),
          ),
        ),

        // 5. Right Action Sidebar (Like, Comment, Share, Save, Watch Full)
        Positioned(
          bottom: 28 + widget.bottomInset,
          right: 14,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              // Like Action
              _buildActionButton(
                icon: _isLiked ? Icons.favorite : Icons.favorite_border,
                label: _likeCount > 0 ? '$_likeCount' : 'Like',
                iconColor: _isLiked ? const Color(0xFFF43F5E) : Colors.white,
                onTap: _toggleLike,
              ),
              const SizedBox(height: 18),

              // Comment Action
              _buildActionButton(
                icon: Icons.chat_bubble_outline,
                label: _commentCount > 0 ? '$_commentCount' : 'Comment',
                onTap: _showCommentsModal,
              ),
              const SizedBox(height: 18),

              // Share Action
              _buildActionButton(
                icon: Icons.share_outlined,
                label: 'Share',
                onTap: _shareShort,
              ),
              const SizedBox(height: 18),

              // Bookmark / Save Action
              _buildActionButton(
                icon: _isSaved ? Icons.bookmark : Icons.bookmark_border,
                label: _isSaved ? 'Saved' : 'Save',
                iconColor: _isSaved ? AppColors.brandGold : Colors.white,
                onTap: _toggleWatchlist,
              ),
              const SizedBox(height: 18),

              // Watch full video / page button
              GestureDetector(
                onTap: () {
                  if (widget.short.videoId.isNotEmpty) {
                    context.push('/watch/${widget.short.videoId}');
                  }
                },
                child: Column(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.45),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white24, width: 1),
                      ),
                      child: const Icon(Icons.fullscreen, color: Colors.white, size: 24),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Full page',
                      style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // 6. Bottom-Left Creator & Caption Information
        Positioned(
          bottom: 24 + widget.bottomInset,
          left: 16,
          right: 84,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Creator Row + Subscribe Button
              Row(
                children: [
                  UserAvatar(
                    avatarUrl: widget.short.uploaderAvatarUrl,
                    name: widget.short.creator,
                    size: 36,
                    onTap: () {
                      if (widget.short.uploaderUsername != null) {
                        context.push('/channel/${widget.short.uploaderUsername}');
                      }
                    },
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () {
                        if (widget.short.uploaderUsername != null) {
                          context.push('/channel/${widget.short.uploaderUsername}');
                        }
                      },
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  widget.short.creator,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 4),
                              const Icon(Icons.verified, size: 14, color: AppColors.brandGold),
                            ],
                          ),
                          if (widget.short.uploaderUsername != null)
                            Text(
                              '@${widget.short.uploaderUsername}',
                              style: const TextStyle(
                                color: AppColors.brandGold,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Subscribe Button
                  if (widget.short.uploaderId != null && widget.short.uploaderId!.isNotEmpty)
                    GestureDetector(
                      onTap: _toggleSubscribe,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          gradient: _isSubscribed ? null : AppColors.flameGradient,
                          color: _isSubscribed ? Colors.white.withValues(alpha: 0.15) : null,
                          borderRadius: BorderRadius.circular(20),
                          border: _isSubscribed
                              ? Border.all(color: Colors.white24)
                              : null,
                        ),
                        child: Text(
                          // The container's own gradient/border already
                          // carries the subscribed-vs-not state (website's
                          // ShortsPlayer.tsx keeps the same "In-Family"
                          // label either way) — was previously "Subscribed"
                          // even though every other subscribe control in
                          // this app calls it "In-Family".
                          'In-Family',
                          style: TextStyle(
                            color: _isSubscribed ? Colors.white : Colors.black,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                ],
              ),

              const SizedBox(height: 10),

              // Title / Caption with hashtag highlights
              RichText(
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                text: TextSpan(
                  children: _buildCaptionSpans(widget.short.title),
                ),
              ),

              const SizedBox(height: 8),

              // Soundtrack / Views Meta Pill
              Row(
                children: [
                  if (widget.short.soundtrack != null) ...[
                    const Icon(Icons.music_note, size: 14, color: AppColors.brandGold),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        widget.short.soundtrack?.title ?? 'Soundtrack',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white70, fontSize: 12),
                      ),
                    ),
                    const SizedBox(width: 10),
                  ],
                  Text(
                    widget.short.views,
                    style: const TextStyle(color: Colors.white60, fontSize: 11),
                  ),
                ],
              ),
            ],
          ),
        ),

        // 7. Top Linear Progress Bar — matches the website's ShortsPlayer.tsx,
        // which puts this at the top of the card (like Stories), not the
        // bottom, and uses a plain white fill rather than brand orange.
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: LinearProgressIndicator(
            value: _progress,
            minHeight: 2.5,
            backgroundColor: Colors.white24,
            valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
          ),
        ),

        // 8. Minimize into the floating corner window. Top-right, mirroring
        // the feed's back button top-left (which lives in shorts_page.dart
        // because it must not move with the swipe transform — this one is
        // per-card on purpose, since it acts on *this* card's controller).
        if (widget.onMinimized != null)
          Positioned(
            top: 0,
            right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.only(right: 10, top: 8),
                child: GestureDetector(
                  onTap: _minimize,
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.42),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.picture_in_picture_alt_rounded,
                      color: Colors.white,
                      size: 19,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    Color iconColor = Colors.white,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.45),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white12, width: 1),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              shadows: [
                Shadow(color: Colors.black87, blurRadius: 4),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildShortPoster() {
    String posterUrl = widget.short.poster.trim();
    if (posterUrl.isEmpty && widget.short.muxPlaybackId != null && widget.short.muxPlaybackId!.isNotEmpty) {
      posterUrl = 'https://image.mux.com/${widget.short.muxPlaybackId}/thumbnail.webp?width=640&height=1138&fit_mode=smartcrop&time=1';
    }

    if (posterUrl.isEmpty) {
      return Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF1E293B), Color(0xFF0F172A), Colors.black],
          ),
        ),
        child: const Center(
          child: CircularProgressIndicator(color: AppColors.brandOrange),
        ),
      );
    }

    if (isDataImageUrl(posterUrl)) {
      final bytes = decodeDataImageUrl(posterUrl);
      if (bytes != null) {
        return Image.memory(
          bytes,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => Container(color: Colors.black),
        );
      }
    }

    return CachedNetworkImage(
      imageUrl: posterUrl,
      fit: BoxFit.cover,
      placeholder: (context, url) => Container(
        color: Colors.black,
        child: const Center(
          child: CircularProgressIndicator(color: AppColors.brandOrange),
        ),
      ),
      errorWidget: (context, url, error) => Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF1E293B), Color(0xFF0F172A), Colors.black],
          ),
        ),
        child: const Center(
          child: Icon(Icons.play_arrow_rounded, color: AppColors.brandOrange, size: 48),
        ),
      ),
    );
  }
}

/// Frosted Glass Comments Sheet for Shorts
class _ShortCommentsSheet extends ConsumerStatefulWidget {
  final String videoId;
  final VoidCallback onCommentAdded;

  const _ShortCommentsSheet({
    required this.videoId,
    required this.onCommentAdded,
  });

  @override
  ConsumerState<_ShortCommentsSheet> createState() => _ShortCommentsSheetState();
}

class _ShortCommentsSheetState extends ConsumerState<_ShortCommentsSheet> {
  final TextEditingController _commentCtrl = TextEditingController();
  List<Comment> _comments = [];
  bool _loading = true;
  bool _posting = false;

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
    try {
      final service = ref.read(commentServiceProvider);
      final list = await service.getComments(widget.videoId);
      if (mounted) {
        setState(() {
          _comments = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _postComment() async {
    final text = _commentCtrl.text.trim();
    if (text.isEmpty || _posting) return;

    setState(() => _posting = true);
    final service = ref.read(commentServiceProvider);
    final res = await service.postComment(widget.videoId, text);

    if (mounted) {
      setState(() => _posting = false);
      if (res.comment != null) {
        _commentCtrl.clear();
        setState(() {
          _comments.insert(0, res.comment!);
        });
        widget.onCommentAdded();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.65,
      decoration: BoxDecoration(
        color: AppColors.drawerDark.withValues(alpha: 0.95),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        children: [
          // Drag Handle & Header
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 8),
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${_comments.length} Comments',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white70, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(color: Colors.white12, height: 1),

          // Comments List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.brandOrange))
                : _comments.isEmpty
                    ? const Center(
                        child: Text(
                          'No comments yet. Be the first to comment!',
                          style: TextStyle(color: Colors.white54),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        itemCount: _comments.length,
                        itemBuilder: (ctx, i) {
                          final c = _comments[i];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                CircleAvatar(
                                  radius: 14,
                                  backgroundColor: Colors.white12,
                                  backgroundImage: c.userAvatarUrl != null
                                      ? smartImageProvider(c.userAvatarUrl!)
                                      : null,
                                  child: c.userAvatarUrl == null
                                      ? const Icon(Icons.person, size: 16, color: Colors.white70)
                                      : null,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(
                                            c.userName,
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            c.timeAgo,
                                            style: const TextStyle(
                                              color: Colors.white38,
                                              fontSize: 10,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        c.text,
                                        style: const TextStyle(
                                          color: Colors.white70,
                                          fontSize: 13,
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
          ),

          // Input Bar
          Container(
            padding: EdgeInsets.fromLTRB(
              16,
              8,
              16,
              MediaQuery.of(context).viewInsets.bottom + 12,
            ),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.4),
              border: const Border(top: BorderSide(color: Colors.white10)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentCtrl,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Add a comment...',
                      hintStyle: const TextStyle(color: Colors.white38),
                      filled: true,
                      fillColor: Colors.white.withValues(alpha: 0.08),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(20),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: _posting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation(AppColors.brandOrange),
                          ),
                        )
                      : const Icon(Icons.send, color: AppColors.brandOrange),
                  onPressed: _postComment,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
