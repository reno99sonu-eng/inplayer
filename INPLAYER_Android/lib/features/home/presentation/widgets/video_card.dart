import 'dart:convert';
import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../models/video.dart';

class VideoCard extends StatelessWidget {
  final Video video;

  const VideoCard({
    super.key,
    required this.video,
  });

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

  Widget _buildThumbnail() {
    final thumbnail = video.thumbnail.trim();

    if (thumbnail.isEmpty) {
      return _thumbnailFallback();
    }

    // Supports custom thumbnails returned as data:image/... URLs.
    if (_isDataImage(thumbnail)) {
      final bytes = _decodeDataImage(thumbnail);

      if (bytes != null) {
        return Image.memory(
          bytes,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          errorBuilder: (_, __, ___) => _thumbnailFallback(),
        );
      }

      return _thumbnailFallback();
    }

    // Normal HTTPS/HTTP thumbnail.
    if (thumbnail.startsWith('http://') ||
        thumbnail.startsWith('https://')) {
      return CachedNetworkImage(
        imageUrl: thumbnail,
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        fadeInDuration: const Duration(milliseconds: 150),
        placeholder: (context, url) => Container(
          color: AppColors.surfaceDark,
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
          return _thumbnailFallback();
        },
      );
    }

    return _thumbnailFallback();
  }

  Widget _thumbnailFallback() {
    return Container(
      color: AppColors.surfaceDark,
      child: const Center(
        child: Icon(
          Icons.play_circle_outline,
          size: 42,
          color: AppColors.textSecondaryDark,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: video.videoId.isEmpty
            ? null
            : () {
                context.push('/watch/${video.videoId}');
              },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // YouTube-style 16:9 thumbnail.
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _buildThumbnail(),

                // Duration badge.
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

            const SizedBox(height: 9),

            // Video information.
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white.withValues(alpha: 0.1), width: 1),
                  ),
                  child: _buildAvatar(),
                ),

                const SizedBox(width: 9),

                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        video.title.isEmpty
                            ? 'Untitled video'
                            : video.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textPrimaryDark,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          height: 1.25,
                        ),
                      ),

                      const SizedBox(height: 4),

                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              video.creator,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.textSecondaryDark,
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),

                          if (video.verified) ...[
                            const SizedBox(width: 4),
                            const Icon(
                              Icons.check_circle,
                              size: 11,
                              color: Color(0xFFCBD5E1),
                            ),
                          ],
                        ],
                      ),

                      const SizedBox(height: 2),

                      Text(
                        '${video.views} • ${video.uploaded}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textSecondaryDark,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                
                // More options icon
                if (video.videoId.isNotEmpty)
                  IconButton(
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    icon: const Icon(Icons.more_vert, size: 18, color: AppColors.textSecondaryDark),
                    onPressed: () {
                      // TODO: show options menu
                    },
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatar() {
    final avatar = video.avatar.trim();

    if (avatar.isEmpty) {
      return const CircleAvatar(
        radius: 18,
        backgroundColor: AppColors.surfaceDark,
        child: Icon(
          Icons.person,
          size: 18,
          color: AppColors.textSecondaryDark,
        ),
      );
    }

    if (_isDataImage(avatar)) {
      final bytes = _decodeDataImage(avatar);

      if (bytes != null) {
        return CircleAvatar(
          radius: 18,
          backgroundColor: AppColors.surfaceDark,
          backgroundImage: MemoryImage(bytes),
        );
      }
    }

    if (avatar.startsWith('http://') ||
        avatar.startsWith('https://')) {
      return CircleAvatar(
        radius: 18,
        backgroundColor: AppColors.surfaceDark,
        backgroundImage: CachedNetworkImageProvider(avatar),
      );
    }

    return const CircleAvatar(
      radius: 18,
      backgroundColor: AppColors.surfaceDark,
      child: Icon(
        Icons.person,
        size: 18,
        color: AppColors.textSecondaryDark,
      ),
    );
  }
}