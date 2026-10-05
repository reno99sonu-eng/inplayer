import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/playback_settings_store.dart';
import '../../../../core/utils/responsive.dart';
import '../../../../core/utils/video_preview_gate.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../models/video.dart';
import '../../../watch/presentation/widgets/video_options_sheet.dart';

class VideoCard extends ConsumerStatefulWidget {
  final Video video;

  /// This viewer's existing Interested/Not Interested feedback for this
  /// video, if any — matches RecommendationFeed.tsx's eedbackMap,
  /// loaded once by the feed and passed down so 20+ cards on one screen
  /// don't each fire their own status request.
  final String? initialFeedback;

  /// Enables the premium creator-profile card treatment used by channel pages.
  final bool isChannelProfile;

  const VideoCard({
    super.key,
    required this.video,
    this.initialFeedback,
    this.isChannelProfile = false,
  });

  @override
  ConsumerState<VideoCard> createState() => _VideoCardState();
}

class _VideoCardState extends ConsumerState<VideoCard> {
  // Video preview player
  VideoPlayerController? _previewController;
  Timer? _hoverTimer;
  Timer? _visibilityTimer;
  Timer? _visibilityActivationTimer;
  Timer? _visibilityExitTimer;
  Timer? _previewRetryTimer;
  bool _isPlayingPreview = false;
  bool _isFirstFrameRendered = false;
  bool _dataSaver = false;
  int _previewRetryCount = 0;

  /// Guards against re-entrant _startStreamingPreview calls that would
  /// otherwise tear down a perfectly good controller mid-init and flash.
  bool _isStartingPreview = false;
  bool _visibilityDwellPassed = false;
  int _previewGeneration = 0;

  @override
  void initState() {
    super.initState();
    VideoPreviewGate.instance.activeCardId.addListener(_onActivePreviewChanged);
    _checkDataSaver();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _checkViewportVisibility();
      _visibilityTimer = Timer.periodic(const Duration(milliseconds: 400), (_) {
        _checkViewportVisibility();
      });
    });
  }

  Future<void> _checkDataSaver() async {
    final settings = await PlaybackSettingsStore.get();
    if (mounted) {
      setState(() => _dataSaver = settings.dataSaver);
      if (settings.dataSaver) _stopStreamingPreview();
    }
  }

  void _onActivePreviewChanged() {
    final activeId = VideoPreviewGate.instance.activeCardId.value;
    final isMe =
        activeId == widget.video.videoId && widget.video.videoId.isNotEmpty;
    if (isMe && !_isPlayingPreview && !_isStartingPreview) {
      _startStreamingPreview();
    } else if (!isMe && (_isPlayingPreview || _isStartingPreview)) {
      _stopStreamingPreview();
    }
  }

  @override
  void didUpdateWidget(covariant VideoCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.video.videoId != widget.video.videoId) {
      _stopStreamingPreview();
      VideoPreviewGate.instance.releaseActivePreview(oldWidget.video.videoId);
    }
  }

  @override
  void dispose() {
    _hoverTimer?.cancel();
    _previewRetryTimer?.cancel();
    _visibilityTimer?.cancel();
    _visibilityActivationTimer?.cancel();
    _visibilityExitTimer?.cancel();
    _previewGeneration++;
    final controller = _previewController;
    if (controller != null) _disposePreviewController(controller);
    VideoPreviewGate.instance.activeCardId.removeListener(
      _onActivePreviewChanged,
    );
    VideoPreviewGate.instance.releaseActivePreview(widget.video.videoId);
    super.dispose();
  }

  void _onCardHover(bool isHovered) {
    if (_dataSaver ||
        widget.video.muxPlaybackId == null ||
        widget.video.videoId.isEmpty) {
      return;
    }
    _hoverTimer?.cancel();
    if (isHovered) {
      // Match the short start delay used by the website's preview cards.
      _hoverTimer = Timer(const Duration(milliseconds: 100), () {
        if (!mounted) return;
        VideoPreviewGate.instance.requestActivePreview(
          widget.video.videoId,
          replaceActive: true,
        );
      });
    } else {
      VideoPreviewGate.instance.releaseActivePreview(widget.video.videoId);
    }
  }

  void _checkViewportVisibility({bool afterExitGrace = false}) {
    if (!mounted ||
        _dataSaver ||
        widget.video.muxPlaybackId == null ||
        widget.video.videoId.isEmpty) {
      return;
    }

    final renderObject = context.findRenderObject();
    if (renderObject is! RenderBox ||
        !renderObject.hasSize ||
        !renderObject.attached) {
      return;
    }

    final top = renderObject.localToGlobal(Offset.zero).dy;
    final bottom = top + renderObject.size.height;

    // Get viewport height without establishing InheritedWidget dependencies in a timer
    final view = WidgetsBinding.instance.platformDispatcher.views.firstOrNull;
    final viewportHeight = view != null
        ? view.physicalSize.height / view.devicePixelRatio
        : 1000.0;

    final visibleTop = top.clamp(0.0, viewportHeight);
    final visibleBottom = bottom.clamp(0.0, viewportHeight);
    final visibleHeight = visibleBottom - visibleTop;
    final activeId = VideoPreviewGate.instance.activeCardId.value;
    final visibleThreshold = activeId == widget.video.videoId ? 0.25 : 0.55;
    final isVisible =
        visibleHeight >= renderObject.size.height * visibleThreshold;

    if (isVisible) {
      _visibilityExitTimer?.cancel();
      _visibilityExitTimer = null;
      if (activeId == widget.video.videoId) {
        _visibilityActivationTimer?.cancel();
        _visibilityActivationTimer = null;
        _visibilityDwellPassed = false;
      } else if (!_visibilityDwellPassed) {
        _visibilityActivationTimer ??= Timer(
          const Duration(milliseconds: 300),
          () {
            _visibilityActivationTimer = null;
            if (!mounted) return;
            // Promote directly to avoid re-entering _checkViewportVisibility,
            // which could race with a scroll event that resets
            // _visibilityDwellPassed back to false, causing the timer to
            // restart endlessly and the preview to flicker on/off.
            _visibilityDwellPassed = true;
            VideoPreviewGate.instance.requestActivePreview(widget.video.videoId);
          },
        );
      } else {
        VideoPreviewGate.instance.requestActivePreview(widget.video.videoId);
      }
    } else {
      _visibilityActivationTimer?.cancel();
      _visibilityActivationTimer = null;
      _visibilityDwellPassed = false;
      if (activeId == widget.video.videoId && !afterExitGrace) {
        // Scroll physics and sliver layout can briefly report a card outside
        // the visibility threshold during a frame transition. Keep its
        // decoder alive through that short gap instead of flashing back to
        // the thumbnail and immediately creating a new HLS controller.
        _visibilityExitTimer ??= Timer(const Duration(milliseconds: 350), () {
          _visibilityExitTimer = null;
          if (mounted) {
            _checkViewportVisibility(afterExitGrace: true);
          }
        });
      } else {
        VideoPreviewGate.instance.releaseActivePreview(widget.video.videoId);
      }
    }

  }

  Future<void> _startStreamingPreview() async {
    final muxId = widget.video.muxPlaybackId;
    if (muxId == null || muxId.isEmpty || _dataSaver) return;

    // If already playing or starting, don't tear down and restart.
    if (_isPlayingPreview || _isStartingPreview) return;
    _isStartingPreview = true;
    final generation = ++_previewGeneration;
    VideoPlayerController? controller;

    try {
      await VideoPreviewGate.instance.waitForPreviewDisposals();
      if (!_shouldContinuePreview(generation)) return;

      // Low resolution (360p) muted HLS stream matching Mux preview.
      final url = 'https://stream.mux.com/$muxId.m3u8?max_resolution=360p';
      final previewController = VideoPlayerController.networkUrl(
        Uri.parse(url),
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
      );
      controller = previewController;
      // Keep it reachable while initialize() is pending. If scrolling moves
      // the preview to another card, that controller is queued for teardown
      // before a replacement decoder can be created.
      _previewController = previewController;
      await previewController.initialize();
      if (!_shouldContinuePreview(generation)) {
        _disposePreviewController(previewController);
        return;
      }
      await previewController.setVolume(0.0); // Always muted on feed cards
      await previewController.setLooping(true);
      if (!_shouldContinuePreview(generation)) {
        _disposePreviewController(previewController);
        return;
      }

      // One-way latch: once the first frame is rendered, it stays rendered
      // for the lifetime of this controller. No resets, no flashing.
      previewController.addListener(() {
        if (!mounted || !identical(_previewController, previewController)) {
          return;
        }
        if (!_isFirstFrameRendered &&
            previewController.value.isPlaying &&
            previewController.value.position > Duration.zero &&
            previewController.value.size.width > 0 &&
            previewController.value.size.height > 0) {
          setState(() {
            _isFirstFrameRendered = true;
          });
        }
      });

      await previewController.play();
      if (!_shouldContinuePreview(generation)) {
        _disposePreviewController(previewController);
        return;
      }
      setState(() {
        _isPlayingPreview = true;
        _isStartingPreview = false;
      });
      _previewRetryCount = 0;
      _previewRetryTimer?.cancel();
    } catch (_) {
      // Network error or unsupported video - thumbnail remains smoothly visible
      if (controller != null) _disposePreviewController(controller);
      if (mounted && generation == _previewGeneration) {
        setState(() {
          _isPlayingPreview = false;
          _isFirstFrameRendered = false;
        });
        _schedulePreviewRetry();
      }
    } finally {
      if (generation == _previewGeneration) _isStartingPreview = false;
    }
  }

  bool _shouldContinuePreview(int generation) {
    return mounted &&
        generation == _previewGeneration &&
        !_dataSaver &&
        !VideoPreviewGate.instance.isSuspended &&
        VideoPreviewGate.instance.activeCardId.value == widget.video.videoId;
  }

  void _disposePreviewController(VideoPlayerController controller) {
    if (!identical(_previewController, controller)) return;
    _previewController = null;
    VideoPreviewGate.instance.enqueuePreviewDisposal(() async {
      try {
        await controller.pause();
      } catch (_) {}
      try {
        await controller.dispose();
      } catch (_) {}
    });
  }

  void _schedulePreviewRetry() {
    if (_previewRetryCount >= 1 || !mounted) return;
    _previewRetryCount++;
    _previewRetryTimer?.cancel();
    _previewRetryTimer = Timer(const Duration(milliseconds: 450), () {
      if (!mounted ||
          VideoPreviewGate.instance.activeCardId.value !=
              widget.video.videoId) {
        return;
      }
      unawaited(_startStreamingPreview());
    });
  }

  void _stopStreamingPreview() {
    _hoverTimer?.cancel();
    _previewRetryTimer?.cancel();
    _previewRetryCount = 0;
    _previewGeneration++;
    _isStartingPreview = false;
    final controller = _previewController;
    if (controller != null) _disposePreviewController(controller);
    _visibilityActivationTimer?.cancel();
    _visibilityActivationTimer = null;
    _visibilityExitTimer?.cancel();
    _visibilityExitTimer = null;
    _visibilityDwellPassed = false;
    if (mounted) {
      setState(() {
        _isPlayingPreview = false;
        _isFirstFrameRendered = false;
      });
    }
  }

  Video get video => widget.video;

  bool _isDataImage(String value) {
    return value.trim().toLowerCase().startsWith('data:image/');
  }

  Uint8List? _decodeDataImage(String value) {
    try {
      final commaIndex = value.indexOf(',');
      if (commaIndex == -1) return null;

      final base64Data = value.substring(commaIndex + 1);
      return base64Decode(base64Data);
    } catch (_) {
      return null;
    }
  }

  Widget _buildThumbnail(BuildContext context) {
    final thumbnail = video.thumbnail.trim();

    if (thumbnail.isEmpty) {
      return _thumbnailFallback(context);
    }

    if (_isDataImage(thumbnail)) {
      final bytes = _decodeDataImage(thumbnail);

      if (bytes != null) {
        return Image.memory(
          bytes,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          errorBuilder: (context, error, stackTrace) =>
              _thumbnailFallback(context),
        );
      }

      return _thumbnailFallback(context);
    }

    if (thumbnail.startsWith('http://') || thumbnail.startsWith('https://')) {
      final columns = context.responsiveVideoColumns.clamp(1, 4).toInt();
      final screenWidth = MediaQuery.of(context).size.width;
      final devicePixelRatio = MediaQuery.of(context).devicePixelRatio;
      final cacheWidth =
          (((screenWidth - 32 - (columns - 1) * 16) / columns) *
                  devicePixelRatio)
              .round()
              .clamp(240, 1440)
              .toInt();
      return CachedNetworkImage(
        imageUrl: thumbnail,
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        memCacheWidth: cacheWidth,
        memCacheHeight: (cacheWidth * 9 / 16).round(),
        fadeInDuration: Duration.zero,
        fadeOutDuration: Duration.zero,
        placeholder: (context, url) => Container(
          color: context.isDark
              ? AppColors.surfaceDark
              : AppColors.surfaceLight,
        ),
        errorWidget: (context, url, error) {
          return _thumbnailFallback(context);
        },
      );
    }

    return _thumbnailFallback(context);
  }

  Widget _thumbnailFallback(BuildContext context) {
    return Container(
      color: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
      child: Center(
        child: Icon(
          Icons.play_circle_outline,
          size: 42,
          color: context.textDim,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isChannelProfile = widget.isChannelProfile;

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(isChannelProfile ? 18 : 16),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                _buildThumbnail(context),

                // Faded in rather than popped in, same as the watch page and
                // Raftaar — masks any residual sub-frame gap the seekTo
                // pre-warm above doesn't fully close, instead of it flashing
                // in at full strength.
                if (_isPlayingPreview &&
                    _previewController != null &&
                    _previewController!.value.isInitialized &&
                    _isFirstFrameRendered)
                  Positioned.fill(
                    child: _PreviewFadeIn(
                      // Match the thumbnail's fill-and-crop treatment. This
                      // keeps the live frame the same size as the poster in
                      // the fixed 16:9 card instead of shrinking inside it.
                      child: ColoredBox(
                        color: Colors.black,
                        child: FittedBox(
                          fit: BoxFit.cover,
                          clipBehavior: Clip.hardEdge,
                          child: SizedBox(
                            width: _previewController!.value.size.width > 0
                                ? _previewController!.value.size.width
                                : 640,
                            height: _previewController!.value.size.height > 0
                                ? _previewController!.value.size.height
                                : 360,
                            child: VideoPlayer(_previewController!),
                          ),
                        ),
                      ),
                    ),
                  ),

                if (video.duration.isNotEmpty && !_isFirstFrameRendered)
                  Positioned(
                    right: 8,
                    bottom: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.85),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        video.duration,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),

                if (video.videoId.isNotEmpty && !_isFirstFrameRendered)
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.brandOrange.withValues(alpha: 0.9),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'NEW',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),

                if (_isFirstFrameRendered)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.volume_off,
                            size: 11,
                            color: Colors.white70,
                          ),
                          SizedBox(width: 3),
                          Text(
                            'PREVIEW',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 10),

        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: context.borderSubtle, width: 1),
              ),
              child: _buildAvatar(context),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    video.title.isEmpty ? 'Untitled video' : video.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: context.textPrimary,
                      fontSize: isChannelProfile ? 15 : 14,
                      fontWeight: FontWeight.w700,
                      height: 1.25,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${video.creator} • ${video.views} • ${video.uploaded}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: context.textSecondary,
                      fontSize: isChannelProfile ? 12.5 : 12,
                    ),
                  ),
                ],
              ),
            ),
            if (video.videoId.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(left: 6),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: context.borderSubtle),
                ),
                child: IconButton(
                  padding: const EdgeInsets.all(6),
                  constraints: const BoxConstraints(),
                  icon: Icon(
                    Icons.more_vert,
                    size: 18,
                    color: context.textSecondary,
                  ),
                  onPressed: () => showVideoOptionsSheet(context, video),
                ),
              ),
          ],
        ),
      ],
    );

    final decorated = isChannelProfile
        ? Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: context.isDark
                  ? const Color(0xFF111827)
                  : const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: context.borderSubtle.withValues(alpha: 0.7),
              ),
              boxShadow: [
                BoxShadow(
                  color:
                      (context.isDark ? Colors.black : const Color(0xFFE2E8F0))
                          .withValues(alpha: 0.14),
                  blurRadius: 18,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: content,
          )
        : content;

    return Material(
      color: Colors.transparent,
      child: MouseRegion(
        onEnter: (_) => _onCardHover(true),
        onExit: (_) => _onCardHover(false),
        child: InkWell(
          borderRadius: BorderRadius.circular(isChannelProfile ? 20 : 16),
          onTap: video.videoId.isEmpty
              ? null
              : () {
                  _stopStreamingPreview();
                  if (video.isShort) {
                    context.push('/shorts/${video.videoId}');
                  } else {
                    context.push('/watch/${video.videoId}');
                  }
                },
          child: decorated,
        ),
      ),
    );
  }

  Widget _buildAvatar(BuildContext context) {
    return UserAvatar(
      avatarUrl: video.avatar,
      name: video.creator,
      size: 38,
      isVerified: video.verified,
      onTap:
          video.uploaderUsername != null && video.uploaderUsername!.isNotEmpty
          ? () => context.push('/channel/${video.uploaderUsername}')
          : null,
    );
  }
}

/// Owns the preview transition independently of [VideoCard]'s parent feed.
/// Feed-level setState calls can rebuild a card while async shelves or
/// feedback complete; this keeps those updates from replaying the fade.
class _PreviewFadeIn extends StatefulWidget {
  final Widget child;

  const _PreviewFadeIn({required this.child});

  @override
  State<_PreviewFadeIn> createState() => _PreviewFadeInState();
}

class _PreviewFadeInState extends State<_PreviewFadeIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 260),
    )..forward();
    _opacity = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      FadeTransition(opacity: _opacity, child: widget.child);
}
