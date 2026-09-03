import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../models/short.dart';
import '../../../../services/video_service.dart';

class RaftaarShortsRow extends ConsumerStatefulWidget {
  /// Pre-fetched shorts to render (already sliced by the caller). When
  /// null, this widget fetches and shows the full shorts list itself —
  /// the original single-shelf behavior, kept so this widget stays
  /// drop-in usable on its own. home_page.dart's repeating shelf rhythm
  /// fetches the shorts list once and passes a fresh slice into each
  /// shelf instance instead, mirroring the website's shelfCursor
  /// (RecommendationFeed.tsx) so repeated shelves show different shorts
  /// instead of the same ones over and over.
  final List<Short>? shorts;
  final String title;

  const RaftaarShortsRow({
    super.key,
    this.shorts,
    this.title = 'Raftaar Shorts',
  });

  @override
  ConsumerState<RaftaarShortsRow> createState() => _RaftaarShortsRowState();
}

class _RaftaarShortsRowState extends ConsumerState<RaftaarShortsRow> {
  List<Short> _shorts = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    if (widget.shorts != null) {
      _shorts = widget.shorts!;
      _isLoading = false;
    } else {
      _loadShorts();
    }
  }

  @override
  void didUpdateWidget(covariant RaftaarShortsRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.shorts != null && widget.shorts != oldWidget.shorts) {
      setState(() {
        _shorts = widget.shorts!;
        _isLoading = false;
      });
    }
  }

  Future<void> _loadShorts() async {
    try {
      final videoService = ref.read(videoServiceProvider);
      final shorts = await videoService.getShorts();
      if (mounted) {
        setState(() {
          _shorts = shorts;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_isLoading && _shorts.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              const Text('⚡', style: TextStyle(fontSize: 18)),
              const SizedBox(width: 8),
              Text(
                widget.title,
                style: TextStyle(
                  color: context.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => context.push('/shorts'),
                child: const Text(
                  'View all',
                  style: TextStyle(
                    color: AppColors.brandOrange,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        SizedBox(
          height: 240,
          child: _isLoading
              ? _buildLoading(context)
              : ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _shorts.length,
                  itemBuilder: (context, index) {
                    final short = _shorts[index];
                    return _buildShortCard(context, short);
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildLoading(BuildContext context) {
    return ListView.builder(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: 5,
      itemBuilder: (context, index) {
        return Container(
          width: 135,
          margin: const EdgeInsets.only(right: 12),
          decoration: BoxDecoration(
            color: context.isDark
                ? Colors.white.withValues(alpha: 0.08)
                : Colors.black.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(14),
          ),
        );
      },
    );
  }

  Widget _buildShortCard(BuildContext context, Short short) {
    return GestureDetector(
      onTap: () {
        if (short.videoId.isNotEmpty) {
          context.push('/shorts/${short.videoId}');
        } else {
          context.push('/shorts');
        }
      },
      child: Container(
        width: 135,
        margin: const EdgeInsets.only(right: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: Colors.black,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.15),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        clipBehavior: Clip.hardEdge,
        child: Stack(
          fit: StackFit.expand,
          children: [
            _buildPoster(context, short),
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              height: 120,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.85),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.brandOrange.withValues(alpha: 0.95),
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
            Positioned(
              bottom: 8,
              left: 8,
              right: 8,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    short.title.isEmpty ? 'Untitled' : short.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    short.creator,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.brandOrangeLight,
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${short.views} views • ${short.likes} likes',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 9,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPoster(BuildContext context, Short short) {
    String posterUrl = short.poster.trim();
    if (posterUrl.isEmpty &&
        short.muxPlaybackId != null &&
        short.muxPlaybackId!.isNotEmpty) {
      posterUrl =
          'https://image.mux.com/${short.muxPlaybackId}/thumbnail.webp?width=640&height=1138&fit_mode=smartcrop&time=1';
    }

    if (posterUrl.isEmpty) {
      return _buildPosterFallback();
    }

    if (isDataImageUrl(posterUrl)) {
      final bytes = decodeDataImageUrl(posterUrl);
      if (bytes != null) {
        return Image.memory(
          bytes,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => _buildPosterFallback(),
        );
      }
      return _buildPosterFallback();
    }

    return CachedNetworkImage(
      imageUrl: posterUrl,
      fit: BoxFit.cover,
      useOldImageOnUrlChange: true,
      fadeInDuration: Duration.zero,
      fadeOutDuration: Duration.zero,
      placeholder: (context, url) => Container(
        color: AppColors.surfaceDark,
      ),
      errorWidget: (context, url, error) => _buildPosterFallback(),
    );
  }

  Widget _buildPosterFallback() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF1E293B), Color(0xFF0F172A), Colors.black],
        ),
      ),
      child: const Center(
        child: Icon(
          Icons.play_arrow_rounded,
          color: AppColors.brandOrange,
          size: 36,
        ),
      ),
    );
  }
}
