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
  bool _isPlayingPreview = false;
  bool _isFirstFrameRendered = false;
  bool _dataSaver = false;
  /// Guards against re-entrant _startStreamingPreview calls that would
  /// otherwise tear down a perfectly good controller mid-init and flash.
  bool _isStartingPreview = false;

  @override
  void initState() {
    super.initState();
    VideoPreviewGate.instance.activeCardId.addListener(_onActivePreviewChanged);
    _checkDataSaver();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _visibilityTimer = Timer.periodic(const Duration(milliseconds: 2000), (_) {
        _checkViewportVisibility();
      });
    });
  }

  Future<void> _checkDataSaver() async {
    final settings = await PlaybackSettingsStore.get();
    if (mounted) {
      setState(() => _dataSaver = settings.dataSaver);
    }
  }

  void _onActivePreviewChanged() {
    final activeId = VideoPreviewGate.instance.activeCardId.value;
    final isMe = activeId == widget.video.videoId && widget.video.videoId.isNotEmpty;
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
    }
  }

  @override
  void dispose() {
    VideoPreviewGate.instance.activeCardId.removeListener(_onActivePreviewChanged);
    VideoPreviewGate.instance.releaseActivePreview(widget.video.videoId);
    _hoverTimer?.cancel();
    _visibilityTimer?.cancel();
    if (_previewController != null) {
      final c = _previewController;
      _previewController = null;
      c?.dispose();
    }
    super.dispose();
  }

  void _onCardHover(bool isHovered) {
    if (_dataSaver || widget.video.muxPlaybackId == null || widget.video.videoId.isEmpty) return;
    _hoverTimer?.cancel();
    if (isHovered) {
      // 200ms debounce matching HOVER_PREVIEW_DELAY in RecommendationFeed.tsx
      _hoverTimer = Timer(const Duration(milliseconds: 200), () {
        if (!mounted) return;
        final activeId = VideoPreviewGate.instance.activeCardId.value;
        if (activeId == null || activeId == widget.video.videoId) {
          VideoPreviewGate.instance.requestActivePreview(widget.video.videoId);
        }
      });
    } else {
      VideoPreviewGate.instance.releaseActivePreview(widget.video.videoId);
    }
  }

  void _checkViewportVisibility() {
    if (!mounted || _dataSaver || widget.video.muxPlaybackId == null || widget.video.videoId.isEmpty) return;

    final renderObject = context.findRenderObject();
    if (renderObject is! RenderBox || !renderObject.hasSize || !renderObject.attached) return;

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
    final isVisible = visibleHeight >= renderObject.size.height * 0.6;

    if (isVisible) {
      final activeId = VideoPreviewGate.instance.activeCardId.value;
      if (activeId == null || activeId == widget.video.videoId) {
        VideoPreviewGate.instance.requestActivePreview(widget.video.videoId);
      }
    } else {
      VideoPreviewGate.instance.releaseActivePreview(widget.video.videoId);
    }
  }

  Future<void> _startStreamingPreview() async {
    final muxId = widget.video.muxPlaybackId;
    if (muxId == null || muxId.isEmpty || _dataSaver) return;

    // If already playing or starting, don't tear down and restart.
    if (_isPlayingPreview || _isStartingPreview) return;
    _isStartingPreview = true;

    // Low resolution (360p) muted HLS stream matching Mux preview
    final url = 'https://stream.mux.com/$muxId.m3u8?max_resolution=360p';
    final controller = VideoPlayerController.networkUrl(
      Uri.parse(url),
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
    );

    try {
      await controller.initialize();
      await controller.setVolume(0.0); // Always muted on feed cards
      await controller.setLooping(true);

      // `video_player`'s ExoPlayer backend on Android can report a playing
      // position past zero slightly before the first decoded frame has
      // actually reached the platform texture — there's no public "first
      // frame rendered" callback to wait on instead, only position/state.
      // Without this, the latch below flips a beat before there's really a
      // picture behind it, and the thumbnail-to-preview swap shows a brief
      // black flash. Forcing one real decode+paint via a 1ms seek, before
      // play() and before the listener below is even attached, closes that
      // gap — same fix Round 29 applied to the watch page and Raftaar.
      // Harmless if it fails.
      try {
        await controller.seekTo(const Duration(milliseconds: 1));
      } catch (_) {}
      // The seekTo Future above resolves when ExoPlayer reports the seek
      // itself complete — not when the decoded frame has actually made it
      // through to the platform Surface/texture Flutter reads from. That
      // hand-off is a separate, unsynchronized step, and on some devices it
      // lags behind the seek-complete callback by more than one frame,
      // which is why the pre-warm alone still let a flash through on some
      // hardware even though it closed the gap on others. A short,
      // deliberate wall-clock wait here is a floor that doesn't depend on
      // what the plugin's Future actually promises, on top of (not instead
      // of) the seek above.
      await Future.delayed(const Duration(milliseconds: 100));

      if (!mounted || VideoPreviewGate.instance.activeCardId.value != widget.video.videoId) {
        await controller.dispose();
        _isStartingPreview = false;
        return;
      }

      // One-way latch: once the first frame is rendered, it stays rendered
      // for the lifetime of this controller. No resets, no flashing.
      controller.addListener(() {
        if (!mounted) return;
        if (!_isFirstFrameRendered &&
            controller.value.isPlaying &&
            controller.value.position > Duration.zero &&
            controller.value.size.width > 0 &&
            controller.value.size.height > 0) {
          setState(() {
            _isFirstFrameRendered = true;
          });
        }
      });

      await controller.play();
      if (!mounted) {
        await controller.dispose();
        _isStartingPreview = false;
        return;
      }
      setState(() {
        _previewController = controller;
        _isPlayingPreview = true;
        _isStartingPreview = false;
      });
    } catch (_) {
      // Network error or unsupported video - thumbnail remains smoothly visible
      await controller.dispose();
      _isStartingPreview = false;
      if (mounted) {
        setState(() {
          _previewController = null;
          _isPlayingPreview = false;
          _isFirstFrameRendered = false;
        });
      }
    }
  }

  void _stopStreamingPreview() {
    _hoverTimer?.cancel();
    _isStartingPreview = false;
    if (_previewController != null) {
      final controller = _previewController;
      _previewController = null;
      controller?.pause();
      controller?.dispose();
    }
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
          errorBuilder: (context, error, stackTrace) => _thumbnailFallback(context),
        );
      }

      return _thumbnailFallback(context);
    }

    if (thumbnail.startsWith('http://') ||
        thumbnail.startsWith('https://')) {
      return CachedNetworkImage(
        imageUrl: thumbnail,
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        fadeInDuration: Duration.zero,
        fadeOutDuration: Duration.zero,
        placeholder: (context, url) => Container(
          color: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
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
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0.0, end: 1.0),
                      duration: const Duration(milliseconds: 260),
                      curve: Curves.easeOut,
                      builder: (context, opacity, child) =>
                          Opacity(opacity: opacity, child: child),
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

                if (video.duration.isNotEmpty && !_isFirstFrameRendered)
                  Positioned(
                    right: 8,
                    bottom: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
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
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
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
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.volume_off, size: 11, color: Colors.white70),
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
                  icon: Icon(Icons.more_vert, size: 18, color: context.textSecondary),
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
              color: context.isDark ? const Color(0xFF111827) : const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: context.borderSubtle.withValues(alpha: 0.7)),
              boxShadow: [
                BoxShadow(
                  color: (context.isDark ? Colors.black : const Color(0xFFE2E8F0)).withValues(alpha: 0.14),
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
      onTap: video.uploaderUsername != null && video.uploaderUsername!.isNotEmpty
          ? () => context.push('/channel/${video.uploaderUsername}')
          : null,
    );
  }
}
