import 'dart:convert';
import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../models/video.dart';
import '../../../../services/video_interaction_service.dart';
import '../../../watch/presentation/widgets/video_options_sheet.dart';

class VideoCard extends ConsumerStatefulWidget {
  final Video video;
  /// This viewer's existing Interested/Not Interested feedback for this
  /// video, if any — matches RecommendationFeed.tsx's `feedbackMap`,
  /// loaded once by the feed and passed down so 20+ cards on one screen
  /// don't each fire their own status request.
  final String? initialFeedback;

  const VideoCard({
    super.key,
    required this.video,
    this.initialFeedback,
  });

  @override
  ConsumerState<VideoCard> createState() => _VideoCardState();
}

class _VideoCardState extends ConsumerState<VideoCard> {
  String? _feedback;
  bool _feedbackBusy = false;

  @override
  void initState() {
    super.initState();
    _feedback = widget.initialFeedback;
  }

  @override
  void didUpdateWidget(covariant VideoCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.video.videoId != widget.video.videoId) {
      _feedback = widget.initialFeedback;
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
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: video.videoId.isEmpty
            ? null
            : () {
                context.push('/watch/${video.videoId}');
              },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 16:9 thumbnail
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _buildThumbnail(context),

                    // Duration badge
                    if (video.duration.isNotEmpty)
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

                    if (video.videoId.isNotEmpty)
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
                  ],
                ),
              ),
            ),

            const SizedBox(height: 10),

            // Video information
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
                          fontSize: 14,
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
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),

                // More options icon
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
          ? () => context.push('/channel/${Uri.encodeComponent(video.uploaderUsername!)}')
          : null,
    );
  }
}
