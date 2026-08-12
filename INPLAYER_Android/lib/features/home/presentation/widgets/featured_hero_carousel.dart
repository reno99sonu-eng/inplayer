import 'dart:async';
import 'dart:ui';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../models/video.dart';

class FeaturedHeroCarousel extends StatefulWidget {
  final List<Video> featuredVideos;

  const FeaturedHeroCarousel({
    super.key,
    required this.featuredVideos,
  });

  @override
  State<FeaturedHeroCarousel> createState() => _FeaturedHeroCarouselState();
}

class _FeaturedHeroCarouselState extends State<FeaturedHeroCarousel> {
  late PageController _pageController;
  int _currentIndex = 0;
  Timer? _timer;

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
    if (widget.featuredVideos.length <= 1) return;
    
    _timer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (_pageController.hasClients) {
        final nextIndex = (_currentIndex + 1) % widget.featuredVideos.length;
        _pageController.animateToPage(
          nextIndex,
          duration: const Duration(milliseconds: 800),
          curve: Curves.fastOutSlowIn,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.featuredVideos.isEmpty) {
      return const SizedBox.shrink();
    }

    return SizedBox(
      height: 380,
      width: double.infinity,
      child: Stack(
        children: [
          // Background blurred image
          Positioned.fill(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 800),
              child: _buildBackgroundImage(
                widget.featuredVideos[_currentIndex].thumbnail,
              ),
            ),
          ),
          
          // Blur effect
          Positioned.fill(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
              child: Container(
                color: Colors.black.withOpacity(0.4),
              ),
            ),
          ),

          // Gradient Overlays
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    AppColors.backgroundDark,
                    AppColors.backgroundDark.withOpacity(0.7),
                    Colors.transparent,
                  ],
                  stops: const [0.0, 0.4, 1.0],
                ),
              ),
            ),
          ),
          
          // Carousel Content
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
              return _buildSlide(video);
            },
          ),
        ],
      ),
    );
  }

  // Some thumbnails come back as inline data:image/...;base64 URIs instead
  // of https:// links — plain Image.network throws "No host specified in
  // URI" on those (see lib/core/utils/image_utils.dart for why).
  Widget _buildBackgroundImage(String thumbnail) {
    final provider = smartImageProvider(thumbnail);

    if (provider == null) {
      return Container(
        key: const ValueKey<String>('empty'),
        color: AppColors.surfaceDark,
      );
    }

    return Image(
      key: ValueKey<String>(thumbnail),
      image: provider,
      fit: BoxFit.cover,
      errorBuilder: (context, error, stackTrace) =>
          Container(color: AppColors.surfaceDark),
    );
  }

  Widget _buildSlide(Video video) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 40, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          // Poster image inside the slide
          Expanded(
            child: Center(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: AspectRatio(
                  aspectRatio: 16 / 9,
                  // CachedNetworkImage only understands http(s) URLs, so a
                  // data:image/...;base64 thumbnail has to be rendered via
                  // Image.memory instead — see _buildBackgroundImage above.
                  child: isDataImageUrl(video.thumbnail)
                      ? _buildBackgroundImage(video.thumbnail)
                      : CachedNetworkImage(
                          imageUrl: video.thumbnail,
                          fit: BoxFit.cover,
                          placeholder: (context, url) => Container(color: AppColors.surfaceDark),
                          errorWidget: (context, url, error) => Container(color: AppColors.surfaceDark),
                        ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            video.title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.bold,
              height: 1.2,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Text(
                video.creator,
                style: const TextStyle(
                  color: AppColors.brandOrange,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (video.verified) ...[
                const SizedBox(width: 4),
                const Icon(
                  Icons.verified,
                  size: 14,
                  color: AppColors.brandGold,
                ),
              ],
              const SizedBox(width: 12),
              Text(
                '${video.views} • ${video.uploaded}',
                style: const TextStyle(
                  color: AppColors.textSecondaryDark,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    if (video.videoId.isNotEmpty) {
                      context.push('/watch/${video.videoId}');
                    }
                  },
                  icon: const Icon(Icons.play_arrow),
                  label: const Text('Watch Now', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                     if (video.videoId.isNotEmpty) {
                      context.push('/watch/${video.videoId}');
                    }
                  },
                  icon: const Icon(Icons.info_outline),
                  label: const Text('More Info', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white.withOpacity(0.2),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    elevation: 0,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
