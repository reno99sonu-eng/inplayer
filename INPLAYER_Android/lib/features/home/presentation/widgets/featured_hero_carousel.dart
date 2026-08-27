import 'dart:async';
import 'dart:ui';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../models/video.dart';
import '../../../../services/watchlist_service.dart';

class FeaturedHeroCarousel extends ConsumerStatefulWidget {
  final List<Video> featuredVideos;

  const FeaturedHeroCarousel({
    super.key,
    required this.featuredVideos,
  });

  @override
  ConsumerState<FeaturedHeroCarousel> createState() => _FeaturedHeroCarouselState();
}

class _FeaturedHeroCarouselState extends ConsumerState<FeaturedHeroCarousel> {
  late PageController _pageController;
  int _currentIndex = 0;
  Timer? _timer;
  bool _isPaused = false;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: 0);
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    if (widget.featuredVideos.length <= 1) return;

    _timer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (_isPaused || !_pageController.hasClients) return;
      final nextIndex = (_currentIndex + 1) % widget.featuredVideos.length;
      _pageController.animateToPage(
        nextIndex,
        duration: const Duration(milliseconds: 700),
        curve: Curves.fastOutSlowIn,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.featuredVideos.isEmpty) {
      return const SizedBox.shrink();
    }

    return AspectRatio(
      aspectRatio: 16 / 9,
      child: GestureDetector(
        onPanDown: (_) => setState(() => _isPaused = true),
        onPanCancel: () => setState(() => _isPaused = false),
        onPanEnd: (_) => setState(() => _isPaused = false),
        child: Container(
          width: double.infinity,
          color: Colors.black,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // 1. Crossfading Background Layer
              PageView.builder(
                controller: _pageController,
                onPageChanged: (index) {
                  setState(() {
                    _currentIndex = index;
                  });
                },
                itemCount: widget.featuredVideos.length,
                itemBuilder: (context, index) {
                  final video = widget.featuredVideos[index];
                  return _buildMediaLayer(video);
                },
              ),

              // 2. Cinematic Gradient Overlays (left dark wash + bottom fade)
              Positioned.fill(
                child: IgnorePointer(
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                        colors: [
                          const Color(0xFF050816).withValues(alpha: 0.95),
                          const Color(0xFF050816).withValues(alpha: 0.65),
                          const Color(0xFF050816).withValues(alpha: 0.20),
                          Colors.transparent,
                        ],
                        stops: const [0.0, 0.45, 0.75, 1.0],
                      ),
                    ),
                  ),
                ),
              ),
              Positioned.fill(
                child: IgnorePointer(
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.85),
                          Colors.transparent,
                        ],
                        stops: const [0.0, 0.5],
                      ),
                    ),
                  ),
                ),
              ),

              // 3. Featured Content Overlay
              Positioned(
                left: 16,
                right: 16,
                bottom: 14,
                child: _buildSlideContent(widget.featuredVideos[_currentIndex % widget.featuredVideos.length]),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMediaLayer(Video video) {
    final thumb = video.thumbnail.trim();

    if (thumb.isEmpty) {
      return Container(
        color: const Color(0xFF080C14),
        child: const Center(
          child: Icon(Icons.movie_outlined, color: Colors.white24, size: 48),
        ),
      );
    }

    if (isDataImageUrl(thumb)) {
      final bytes = decodeDataImageUrl(thumb);
      if (bytes != null) {
        return Stack(
          fit: StackFit.expand,
          children: [
            Image.memory(bytes, fit: BoxFit.cover),
            BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
              child: Container(color: Colors.black.withValues(alpha: 0.3)),
            ),
            Image.memory(bytes, fit: BoxFit.contain),
          ],
        );
      }
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        // Blurred backdrop copy filling any letterbox
        CachedNetworkImage(
          imageUrl: thumb,
          fit: BoxFit.cover,
          errorWidget: (context, url, error) => Container(color: const Color(0xFF080C14)),
        ),
        BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: Container(color: Colors.black.withValues(alpha: 0.35)),
        ),
        // Sharp foreground copy
        CachedNetworkImage(
          imageUrl: thumb,
          fit: BoxFit.cover,
          fadeInDuration: const Duration(milliseconds: 200),
          errorWidget: (context, url, error) => Container(color: const Color(0xFF080C14)),
        ),
      ],
    );
  }

  Widget _buildSlideContent(Video video) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Compact Badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
          decoration: BoxDecoration(
            color: AppColors.brandOrange.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.brandOrange.withValues(alpha: 0.45)),
            boxShadow: [
              BoxShadow(
                color: AppColors.brandOrange.withValues(alpha: 0.20),
                blurRadius: 8,
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 4.5,
                height: 4.5,
                decoration: const BoxDecoration(
                  color: AppColors.brandOrange,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 5),
              const Text(
                '🔥 WEEKLY FEATURED',
                style: TextStyle(
                  color: AppColors.brandGold,
                  fontSize: 8.5,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.4,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 5),

        // Title
        Text(
          video.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.4,
            height: 1.2,
            shadows: [
              Shadow(color: Colors.black, blurRadius: 10, offset: Offset(0, 1)),
            ],
          ),
        ),

        const SizedBox(height: 3),

        // Meta row
        Row(
          children: [
            Flexible(
              child: Text(
                'by ${video.creator}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  shadows: [Shadow(color: Colors.black87, blurRadius: 6)],
                ),
              ),
            ),
            const SizedBox(width: 5),
            Text(
              '•',
              style: TextStyle(
                color: AppColors.brandOrange.withValues(alpha: 0.8),
                fontSize: 11,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(width: 5),
            Text(
              '${video.views} this week',
              style: const TextStyle(
                color: Color(0xFFCBD5E1),
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
                shadows: [Shadow(color: Colors.black87, blurRadius: 6)],
              ),
            ),
          ],
        ),

        const SizedBox(height: 8),

        // Buttons row
        Row(
          children: [
            // Watch Now
            GestureDetector(
              onTap: () {
                if (video.videoId.isNotEmpty) {
                  context.push('/watch/${video.videoId}');
                }
              },
              child: Container(
                height: 32,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  gradient: AppColors.flameGradient,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.brandOrange.withValues(alpha: 0.40),
                      blurRadius: 10,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.play_arrow_rounded, color: Color(0xFF0F172A), size: 16),
                    SizedBox(width: 4),
                    Text(
                      'Watch Now',
                      style: TextStyle(
                        color: Color(0xFF0F172A),
                        fontWeight: FontWeight.w900,
                        fontSize: 11.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(width: 8),

            // Watch Later / Save
            _WatchlistHeroButton(videoId: video.videoId),
          ],
        ),
      ],
    );
  }
}

class _WatchlistHeroButton extends ConsumerStatefulWidget {
  final String videoId;

  const _WatchlistHeroButton({required this.videoId});

  @override
  ConsumerState<_WatchlistHeroButton> createState() => _WatchlistHeroButtonState();
}

class _WatchlistHeroButtonState extends ConsumerState<_WatchlistHeroButton> {
  bool _isSaved = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _checkStatus();
  }

  Future<void> _checkStatus() async {
    if (widget.videoId.isEmpty) return;
    try {
      final saved = await ref.read(watchlistServiceProvider).isSaved(widget.videoId);
      if (mounted) setState(() => _isSaved = saved);
    } catch (_) {}
  }

  Future<void> _toggle() async {
    if (widget.videoId.isEmpty || _busy) return;
    setState(() => _busy = true);

    final prev = _isSaved;
    setState(() => _isSaved = !prev);

    final service = ref.read(watchlistServiceProvider);
    final ok = prev
        ? await service.remove(widget.videoId)
        : await service.add(widget.videoId);

    if (!ok && mounted) {
      setState(() => _isSaved = prev);
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _toggle,
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withValues(alpha: 0.20)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _isSaved ? Icons.check_rounded : Icons.add_rounded,
              color: Colors.white,
              size: 15,
            ),
            const SizedBox(width: 4),
            Text(
              _isSaved ? 'Saved' : 'Watchlist',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 11.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
