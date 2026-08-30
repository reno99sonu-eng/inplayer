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
import '../../../../services/video_interaction_service.dart';
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
  String? _feedback;
  bool _feedbackBusy = false;

  // Video preview player
  VideoPlayerController? _previewController;
  Timer? _hoverTimer;
  Timer? _visibilityTimer;
  bool _isPlayingPreview = false;
  bool _dataSaver = false;

  @override
  void initState() {
    super.initState();
    _feedback = widget.initialFeedback;
    VideoPreviewGate.instance.activeCardId.addListener(_onActivePreviewChanged);
    _checkDataSaver();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _visibilityTimer = Timer.periodic(const Duration(milliseconds: 400), (_) {
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
    if (isMe && !_isPlayingPreview) {
      _startStreamingPreview();
    } else if (!isMe && _isPlayingPreview) {
      _stopStreamingPreview();
    }
  }

  @override
  void didUpdateWidget(covariant VideoCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.video.videoId != widget.video.videoId) {
      _feedback = widget.initialFeedback;
      _stopStreamingPreview();
    }
  }

  @override
  void dispose() {
    VideoPreviewGate.instance.activeCardId.removeListener(_onActivePreviewChanged);
    VideoPreviewGate.instance.releaseActivePreview(widget.video.videoId);
    _hoverTimer?.cancel();
    _visibilityTimer?.cancel();
    _previewController?.dispose();
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

    _previewController?.dispose();
    // Low resolution (360p or 480p) muted HLS stream matching Mux preview
    final url = 'https://stream.mux.com/$muxId.m3u8?max_resolution=360p';
    final controller = VideoPlayerController.networkUrl(
      Uri.parse(url),
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
    );

    try {
      await controller.initialize();
      await controller.setVolume(0.0); // Always muted on feed cards
      await controller.setLooping(true);
      if (!mounted || VideoPreviewGate.instance.activeCardId.value != widget.video.videoId) {
        await controller.dispose();
        return;
      }
      await controller.play();
      setState(() {
        _previewController = controller;
        _isPlayingPreview = true;
      });
    } catch (_) {
      // Network error or unsupported video - thumbnail remains smoothly visible
      await controller.dispose();
      if (mounted) {
        setState(() {
          _previewController = null;
          _isPlayingPreview = false;
        });
      }
    }
  }

  void _stopStreamingPreview() {
    _hoverTimer?.cancel();
    if (_previewController != null) {
      final controller = _previewController;
      _previewController = null;
      controller?.pause();
      controller?.dispose();
    }
    if (mounted) {
      setState(() => _isPlayingPreview = false);
    }
  }

  Video get video => widget.video;

  Future<void> _toggleFeedback(String value) async {
    if (_feedbackBusy || video.videoId.isEmpty) return;
    final previous = _feedback;
    setState(() {
      _feedback = _feedback == value ? null : value;
      _feedbackBusy = true;
    });
    final result = await ref.read(videoInteractionServiceProvider).submitFeedback(video.videoId, value);
    if (!mounted) return;
    setState(() {
      _feedback = result.ok ? result.feedback : previous;
      _feedbackBusy = false;
    });
  }

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
        fadeInDuration: const Duration(milliseconds: 150),
        placeholder: (context, url) => Container(
          color: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
          child: const Center(
            child: SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(
                  AppColors.brandOrange,
                ),
              ),
            ),
          ),
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

                if (_isPlayingPreview &&
                    _previewController != null &&
                    _previewController!.value.isInitialized)
                  Positioned.fill(
                    child: FittedBox(
                      fit: BoxFit.cover,
                      clipBehavior: Clip.hardEdge,
                      child: SizedBox(
                        width: _previewController!.value.size.width,
                        height: _previewController!.value.size.height,
                        child: VideoPlayer(_previewController!),
                      ),
                    ),
                  ),

                if (video.duration.isNotEmpty && !_isPlayingPreview)
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

                if (video.videoId.isNotEmpty && !_isPlayingPreview)
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

                if (_isPlayingPreview)
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
        if (!isChannelProfile) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              const SizedBox(width: 46),
              _buildFeedbackButton(context, Icons.thumb_up_outlined, Icons.thumb_up_alt, 'Interested', 'interested'),
              const SizedBox(width: 8),
              _buildFeedbackButton(context, Icons.thumb_down_outlined, Icons.thumb_down_alt, 'Not Interested', 'not_interested'),
            ],
          ),
        ],
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
                  context.push('/watch/${video.videoId}');
                },
          child: decorated,
        ),
      ),
    );
  }

  Widget _buildFeedbackButton(BuildContext context, IconData outlineIcon, IconData filledIcon, String label, String value) {
    final active = _feedback == value;
    return GestureDetector(
      onTap: video.videoId.isEmpty ? null : () => _toggleFeedback(value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: active ? AppColors.brandOrange : context.borderSubtle),
          color: active ? AppColors.brandOrange.withValues(alpha: 0.12) : null,
        ),
        child: Row(
          children: [
            Icon(active ? filledIcon : outlineIcon, size: 12, color: active ? AppColors.brandOrange : context.textSecondary),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: active ? AppColors.brandOrange : context.textSecondary,
              ),
            ),
          ],
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
