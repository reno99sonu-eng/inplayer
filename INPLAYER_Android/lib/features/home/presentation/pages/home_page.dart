import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_logo.dart';
import '../../../../models/video.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/video_service.dart';
import '../../../profile/presentation/pages/profile_page.dart';
import '../../../shorts/presentation/pages/shorts_page.dart';
import '../../../subscriptions/presentation/pages/subscriptions_page.dart';
import '../../../upload/presentation/pages/upload_page.dart';
import '../widgets/video_card.dart';
import '../widgets/featured_hero_carousel.dart';
import '../widgets/trending_now_row.dart';
import '../widgets/floating_ai_button.dart';
import '../widgets/mobile_menu_drawer.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  int _currentIndex = 0;

  late final List<Widget> _pages = [
    const HomeFeedPage(),
    const ShortsPage(),
    const UploadPage(),
    const SubscriptionsPage(),
    const ProfilePage(),
  ];

  @override
  Widget build(BuildContext context) {
    // Keep the auth provider active so the rest of the app
    // continues to receive the authenticated user's state.
    ref.watch(authStateProvider);

    return Scaffold(
      extendBody: true,
      backgroundColor: AppColors.backgroundDark,
      drawer: const MobileMenuDrawer(),
      body: Stack(
        children: [
          IndexedStack(
            index: _currentIndex,
            children: _pages,
          ),
          const FloatingAIButton(),
        ],
      ),
      bottomNavigationBar: _buildBottomNavigationBar(),
    );
  }

  Widget _buildBottomNavigationBar() {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.cardDark.withValues(alpha: 0.95),
            border: Border(
              top: BorderSide(
                color: Colors.white.withValues(alpha: 0.1),
                width: 1,
              ),
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 8,
                vertical: 8,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildNavItem(
                    0,
                    Icons.home,
                    'Home',
                  ),
                  _buildNavItem(
                    1,
                    Icons.slideshow,
                    'Raftaar',
                  ),
                  _buildCreateButton(),
                  _buildNavItem(
                    3,
                    Icons.rss_feed,
                    'In-Family',
                  ),
                  _buildNavItem(
                    4,
                    Icons.person_outline,
                    'Profile',
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
    int index,
    IconData icon,
    String label,
  ) {
    final isActive = _currentIndex == index;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        setState(() {
          _currentIndex = index;
        });
      },
      child: Container(
        constraints: const BoxConstraints(
          minWidth: 62,
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: 10,
          vertical: 8,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isActive
                  ? AppColors.brandOrange
                  : AppColors.textSecondaryDark,
              size: 21,
              shadows: isActive
                  ? [
                      Shadow(
                        color: AppColors.brandOrange.withValues(alpha: 0.85),
                        blurRadius: 12,
                      )
                    ]
                  : null,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: isActive
                    ? AppColors.brandOrange
                    : AppColors.textSecondaryDark,
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w900 : FontWeight.w500,
                shadows: isActive
                    ? [
                        Shadow(
                          color: AppColors.brandOrange.withValues(alpha: 0.7),
                          blurRadius: 8,
                        )
                      ]
                    : null,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCreateButton() {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        setState(() {
          _currentIndex = 2;
        });
      },
      child: Container(
        width: 58,
        height: 58,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.brandOrange,
              AppColors.brandGold,
            ],
          ),
          borderRadius: BorderRadius.circular(17),
          boxShadow: [
            BoxShadow(
              color: AppColors.brandOrange.withValues(alpha: 0.4),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: const Icon(
          Icons.add,
          color: Colors.white,
          size: 30,
        ),
      ),
    );
  }
}

class HomeFeedPage extends ConsumerStatefulWidget {
  const HomeFeedPage({super.key});

  @override
  ConsumerState<HomeFeedPage> createState() => _HomeFeedPageState();
}

class _HomeFeedPageState extends ConsumerState<HomeFeedPage> {
  late Future<List<Video>> _videosFuture;
  late Future<List<Video>> _featuredFuture;

  @override
  void initState() {
    super.initState();

    final videoService = ref.read(videoServiceProvider);

    _videosFuture = videoService.getVideos();
    _featuredFuture = videoService.getFeaturedWeekly();
  }

  Future<void> _refreshContent() async {
    final videoService = ref.read(videoServiceProvider);

    setState(() {
      _videosFuture = videoService.getVideos();
      _featuredFuture = videoService.getFeaturedWeekly();
    });

    await Future.wait([
      _videosFuture,
      _featuredFuture,
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: AppColors.cardDark,
      onRefresh: _refreshContent,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverAppBar(
            floating: true,
            snap: true,
            backgroundColor: const Color(0xFF06101D).withValues(alpha: 0.9),
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            toolbarHeight: 72,
            titleSpacing: 16,
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 28, sigmaY: 28),
                child: Container(
                  color: Colors.transparent,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // INPLAYER Background Watermark
                      Text(
                        'INPLAYER',
                        style: TextStyle(
                          fontSize: 54,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 18.9, // 0.35em
                          color: Colors.white.withValues(alpha: 0.03),
                        ),
                      ),
                      Positioned.fill(
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 1.5, sigmaY: 1.5),
                          child: const SizedBox(),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            title: Row(
              children: [
                Builder(
                  builder: (context) => GestureDetector(
                    onTap: () => Scaffold.of(context).openDrawer(),
                    child: Container(
                      width: 44,
                      height: 44,
                      margin: const EdgeInsets.only(right: 12),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                      ),
                      child: const Icon(
                        Icons.menu,
                        color: Colors.white,
                        size: 22,
                      ),
                    ),
                  ),
                ),
                const AppLogo(height: 34),
                const Spacer(),
                _buildHeaderIcon(
                  Icons.search,
                  () => context.push('/search'),
                ),
                _buildHeaderIcon(
                  Icons.shopping_bag_outlined,
                  () {
                    context.push('/marketplace');
                  },
                ),
                _buildHeaderIcon(
                  Icons.notifications_outlined,
                  () {
                    context.push('/notifications');
                  },
                ),
              ],
            ),
          ),

          SliverToBoxAdapter(
            child: _buildHomeContent(),
          ),

          const SliverToBoxAdapter(
            child: SizedBox(height: 100),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderIcon(
    IconData icon,
    VoidCallback onTap,
  ) {
    return Container(
      margin: const EdgeInsets.only(left: 8),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(14),
      ),
      child: IconButton(
        icon: Icon(
          icon,
          color: AppColors.textPrimaryDark,
          size: 22,
        ),
        onPressed: onTap,
        tooltip: icon == Icons.search
            ? 'Search'
            : 'Notifications',
      ),
    );
  }

  Widget _buildHomeContent() {
    return FutureBuilder<List<Video>>(
      future: _videosFuture,
      builder: (context, videoSnapshot) {
        if (videoSnapshot.connectionState ==
            ConnectionState.waiting) {
          return const Padding(
            padding: EdgeInsets.symmetric(
              horizontal: 24,
              vertical: 80,
            ),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(
                    color: AppColors.brandOrange,
                  ),
                  SizedBox(height: 16),
                  Text(
                    'Loading videos...',
                    style: TextStyle(
                      color: AppColors.textSecondaryDark,
                    ),
                  ),
                ],
              ),
            ),
          );
        }

        if (videoSnapshot.hasError) {
          return _buildErrorState();
        }

        final videos = videoSnapshot.data ?? [];

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildFeaturedFromBackend(),

            const SizedBox(height: 16),

            if (videos.isEmpty)
              _buildEmptyState()
            else ...[
              _buildVideoGrid(videos.take(4).toList()),
              const SizedBox(height: 24),
              const TrendingNowRow(),
              const SizedBox(height: 24),
              if (videos.length > 4)
                _buildVideoGrid(videos.skip(4).toList()),
            ],
          ],
        );
      },
    );
  }

  Widget _buildFeaturedFromBackend() {
    return FutureBuilder<List<Video>>(
      future: _featuredFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const SizedBox(
            height: 380,
            child: Center(
              child: CircularProgressIndicator(color: AppColors.brandOrange),
            ),
          );
        }

        final featuredVideos = snapshot.data ?? [];

        if (featuredVideos.isEmpty) {
          return const SizedBox.shrink();
        }

        return FeaturedHeroCarousel(featuredVideos: featuredVideos);
      },
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: 16,
        vertical: 10,
      ),
      child: Row(
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 21,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimaryDark,
            ),
          ),
          const Spacer(),
          GestureDetector(
            onTap: () {
              // Navigation for the full section can be connected
              // once the corresponding pages/routes are finalized.
            },
            child: Text(
              'See all',
              style: TextStyle(
                color: AppColors.brandOrange,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Replaced by FeaturedHeroCarousel

  Widget _buildVideoGrid(List<Video> videos) {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: videos.length,
      separatorBuilder: (context, index) => const SizedBox(height: 24),
      itemBuilder: (context, index) {
        return VideoCard(
          video: videos[index],
        );
      },
    );
  }

  Widget _buildErrorState() {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: 24,
        vertical: 80,
      ),
      child: Column(
        children: [
          const Icon(
            Icons.cloud_off_outlined,
            size: 56,
            color: AppColors.textSecondaryDark,
          ),
          const SizedBox(height: 18),
          const Text(
            'Unable to load videos',
            style: TextStyle(
              color: AppColors.textPrimaryDark,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Please check your connection and try again.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.textSecondaryDark,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _refreshContent,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.brandOrange,
              foregroundColor: Colors.white,
            ),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: 24,
        vertical: 70,
      ),
      child: Column(
        children: [
          Icon(
            Icons.video_library_outlined,
            size: 60,
            color: AppColors.textSecondaryDark.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 16),
          const Text(
            'No videos available',
            style: TextStyle(
              color: AppColors.textPrimaryDark,
              fontSize: 17,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'New videos will appear here when they are published.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.textSecondaryDark.withValues(alpha: 0.8),
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}