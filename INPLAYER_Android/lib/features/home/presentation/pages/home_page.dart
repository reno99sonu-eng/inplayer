import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_logo.dart';
import '../../../../models/video.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/video_service.dart';
import '../../../../services/notification_badge_service.dart';
import '../../../profile/presentation/pages/profile_page.dart';
import '../../../shorts/presentation/pages/shorts_page.dart';
import 'music_page.dart';
import '../../../upload/presentation/pages/upload_page.dart';
import '../widgets/video_card.dart';
import '../widgets/featured_hero_carousel.dart';
import '../widgets/trending_now_row.dart';
import '../widgets/raftaar_shorts_row.dart';
import '../widgets/kids_row.dart';
import '../widgets/playables_shelf.dart';
import '../widgets/home_ad_card.dart';
import '../../../music/presentation/widgets/mini_player_bar.dart';
import '../../../../services/music_player_service.dart';
import '../../../../services/content_access_service.dart';
import '../../../../services/platform_update_service.dart';
import '../../../watch/presentation/widgets/video_mini_player_overlay.dart';
import '../../../../models/short.dart';
import '../../../../services/video_interaction_service.dart';
import '../widgets/mobile_menu_drawer.dart';
import '../widgets/profile_menu_modal.dart';
import '../widgets/create_menu_popup.dart';
import '../../../auth/presentation/widgets/auth_modals.dart';
import '../../../../core/widgets/notification_permission_helper.dart';
import '../../../../providers/kid_mode_provider.dart';
import '../../../safety/presentation/widgets/parental_pin_dialog.dart';
import '../../../../core/widgets/pattern_background.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../models/user.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  int _currentIndex = 0;
  final Set<int> _builtTabs = <int>{0};

  void _selectTab(int index) {
    if (_currentIndex == index && _builtTabs.contains(index)) return;
    setState(() {
      _builtTabs.add(index);
      _currentIndex = index;
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      NotificationPermissionHelper.maybePrompt(context);
    });
  }

  /// Index of the Raftaar tab. Named because three separate things below
  /// key off it — the bottom bar goes transparent, its labels switch to
  /// over-video colours, and the shorts feed gets told how much of its
  /// bottom edge the bar covers.
  static const int _raftaarTab = 1;

  /// How much of the screen's bottom edge the navigation bar occupies.
  ///
  /// The Scaffold below sets `extendBody: true`, so every page renders full
  /// height and the bar floats on top of the last stretch of it. On normal
  /// tabs that is fine (their content scrolls and ends in padding), but the
  /// Raftaar feed pins its controls to the bottom, so without being told
  /// this number it puts the Save button and the channel row underneath the
  /// bar where they get clipped — the "cropped entirely from below" report.
  /// Matches the clearance FloatingAIButton already uses for the same bar.
  static const double _bottomNavInset = 88.0;

  /// Extra clearance for MiniPlayerBar, which stacks ABOVE the nav bar in the
  /// same bottomNavigationBar Column whenever a track is loaded. Roughly its
  /// real height: 40px artwork + 8px padding top and bottom + the 2px
  /// progress line + its 6px bottom margin. Without adding this on top of
  /// _bottomNavInset, Raftaar's controls clear the nav bar but still sit
  /// underneath the music bar while music happens to be playing.
  static const double _miniPlayerInset = 64.0;

  List<Widget> _buildPages({
    required double shortsBottomInset,
    required String feedRevision,
  }) {
    return [
      _builtTabs.contains(0)
          ? HomeFeedPage(key: ValueKey('home-feed-$feedRevision'))
          : const SizedBox.shrink(),
      _builtTabs.contains(1)
          ? ShortsPage(
              key: ValueKey('shorts-$feedRevision'),
              isActive: _currentIndex == _raftaarTab,
              bottomInset: shortsBottomInset,
              // Nothing to pop here — Raftaar is a tab, not a pushed route — so
              // "back" means returning to the Home tab.
              onExit: () => _selectTab(0),
            )
          : const SizedBox.shrink(),
      _builtTabs.contains(2) ? const UploadPage() : const SizedBox.shrink(),
      _builtTabs.contains(3)
          ? MusicPage(key: ValueKey('music-$feedRevision'))
          : const SizedBox.shrink(),
      _builtTabs.contains(4) ? const ProfilePage() : const SizedBox.shrink(),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final contentAccessRevision = ref.watch(contentAccessRevisionProvider);
    final platformUpdateRevision = ref.watch(platformUpdateRevisionProvider);
    final feedRevision = '$contentAccessRevision-$platformUpdateRevision';

    // MiniPlayerBar only occupies space while a track is loaded, so the
    // clearance Raftaar needs is not a constant — watching the player here
    // means the shorts overlay lifts and settles as music starts and stops,
    // instead of being permanently over-padded or permanently clipped.
    final musicLoaded = ref.watch(
      musicPlayerServiceProvider.select((p) => p.currentTrack != null),
    );
    final shortsBottomInset =
        _bottomNavInset + (musicLoaded ? _miniPlayerInset : 0.0);

    return Scaffold(
      extendBody: true,
      backgroundColor: Colors.transparent,
      drawer: const MobileMenuDrawer(),
      body: PatternBackground(
        child: Stack(
          children: [
            IndexedStack(
              index: _currentIndex,
              children: _buildPages(
                shortsBottomInset: shortsBottomInset,
                feedRevision: feedRevision,
              ),
            ),
            const VideoMiniPlayerOverlay(),
            // Kids Mode Safety Banner Indicator
            Consumer(
              builder: (context, ref, _) {
                final isKid = ref.watch(
                  kidModeProvider.select((s) => s.isEnabled),
                );
                if (!isKid) return const SizedBox.shrink();

                return Positioned(
                  top: MediaQuery.of(context).padding.top + 6,
                  left: 16,
                  right: 16,
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => ParentalPinDialog.show(context),
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xE6065F46),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: const Color(0xFF10B981),
                            width: 1.2,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(
                                0xFF10B981,
                              ).withValues(alpha: 0.3),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.child_care_rounded,
                              color: Colors.white,
                              size: 18,
                            ),
                            const SizedBox(width: 8),
                            const Expanded(
                              child: Text(
                                'Kids Safe Mode Active • Content Filtered',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'EXIT (PIN)',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [const MiniPlayerBar(), _buildBottomNavigationBar(context)],
      ),
    );
  }

  /// Bottom navigation bar — matches the web app's MobileBottomNav.tsx:
  /// - Frosted glass bg: #06101D/95% dark, #F5EEDC/95% light
  /// - backdrop-blur-2xl
  /// - border-t: theme adaptive
  /// - Active: orange-400 icon with drop-shadow glow, font-black, scale-105
  /// Bottom navigation bar — matches the web app's MobileBottomNav.tsx:
  /// - Frosted glass bg: #06101D/95% dark, #F5EEDC/95% light
  /// - backdrop-blur-2xl
  /// - border-t: theme adaptive
  /// - Active: orange-400 icon with drop-shadow glow, font-black, scale-105
  Widget _buildBottomNavigationBar(BuildContext context) {
    final isDark = context.isDark;
    final authState = ref.watch(authStateProvider);
    final user = authState is AuthStateAuthenticated ? authState.user : null;

    // On the Raftaar tab this bar floats over full-bleed video. A 95%-opaque
    // slab there reads as the video being sliced off at the bottom, which is
    // how it was being described. Over video it becomes a genuinely
    // transparent bar sitting on a soft upward gradient: the picture stays
    // visible all the way down, and the gradient is what keeps the icons
    // readable against a bright frame instead of a solid panel doing it.
    final overVideo = _currentIndex == _raftaarTab;

    return ClipRect(
      child: Container(
        decoration: BoxDecoration(
          // color and gradient are mutually exclusive on BoxDecoration —
          // setting both trips an assertion — hence the null on each side.
          color: overVideo
              ? null
              : (isDark ? AppColors.navbarDark : AppColors.navbarLight)
                    .withValues(alpha: 0.95),
          gradient: overVideo
              ? LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.70),
                    Colors.black.withValues(alpha: 0.26),
                    Colors.transparent,
                  ],
                  stops: const [0.0, 0.62, 1.0],
                )
              : null,
          // No hard top edge or drop shadow over video — both would draw
          // the same line the transparency is meant to remove.
          border: overVideo
              ? null
              : Border(
                  top: BorderSide(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.10)
                        : Colors.black.withValues(alpha: 0.08),
                    width: 1,
                  ),
                ),
          boxShadow: overVideo
              ? null
              : [
                  BoxShadow(
                    color: isDark
                        ? Colors.black.withValues(alpha: 0.45)
                        : Colors.black.withValues(alpha: 0.08),
                    blurRadius: 25,
                    offset: const Offset(0, -4),
                  ),
                ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(0, Icons.home_outlined, 'Home', context),
                _buildNavItem(1, Icons.play_circle_outline, 'Raftaar', context),
                _buildCreateButton(context),
                _buildNavItem(3, Icons.music_note_outlined, 'Music', context),
                _buildYouNavItem(4, 'You', context, user),
              ],
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
    BuildContext context,
  ) {
    final isActive = _currentIndex == index;
    // Over video the bar has no panel behind it any more, so the normal
    // theme-secondary colour stops working — in light mode it's a dark grey
    // that vanishes against a dark frame. Force a light tint plus a soft
    // dark shadow there so the labels stay readable on any footage, which is
    // the "buttons visibility" half of making the bar transparent.
    final overVideo = _currentIndex == _raftaarTab;
    final inactiveColor = overVideo
        ? Colors.white.withValues(alpha: 0.80)
        : (context.isDark
              ? AppColors.textSecondaryDark
              : AppColors.textSecondaryLight);
    final legibilityShadows = overVideo
        ? [Shadow(color: Colors.black.withValues(alpha: 0.85), blurRadius: 6)]
        : null;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _selectTab(index),
      child: AnimatedScale(
        scale: isActive ? 1.05 : 1.0,
        duration: const Duration(milliseconds: 200),
        child: Container(
          constraints: const BoxConstraints(minWidth: 62),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                color: isActive ? AppColors.brandOrangeLight : inactiveColor,
                size: 19,
                shadows: isActive
                    ? [
                        Shadow(
                          color: AppColors.brandOrange.withValues(alpha: 0.85),
                          blurRadius: 12,
                        ),
                      ]
                    : legibilityShadows,
              ),
              const SizedBox(height: 1),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: isActive ? AppColors.brandOrangeLight : inactiveColor,
                  fontSize: 9.5,
                  fontWeight: isActive ? FontWeight.w900 : FontWeight.w500,
                  shadows: isActive
                      ? [
                          Shadow(
                            color: AppColors.brandOrange.withValues(
                              alpha: 0.70,
                            ),
                            blurRadius: 8,
                          ),
                        ]
                      : legibilityShadows,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildYouNavItem(
    int index,
    String label,
    BuildContext context,
    User? user,
  ) {
    final isActive = _currentIndex == index;
    // Same over-video treatment as _buildNavItem — see the comment there.
    final overVideo = _currentIndex == _raftaarTab;
    final inactiveColor = overVideo
        ? Colors.white.withValues(alpha: 0.80)
        : (context.isDark
              ? AppColors.textSecondaryDark
              : AppColors.textSecondaryLight);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        if (user == null) {
          showSignInModal(context);
        } else {
          showMobileProfileMenu(context);
        }
      },
      child: AnimatedScale(
        scale: isActive ? 1.05 : 1.0,
        duration: const Duration(milliseconds: 200),
        child: Container(
          constraints: const BoxConstraints(minWidth: 62),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isActive
                        ? AppColors.brandOrange
                        : Colors.transparent,
                    width: 1.5,
                  ),
                  boxShadow: isActive
                      ? [
                          BoxShadow(
                            color: AppColors.brandOrange.withValues(
                              alpha: 0.85,
                            ),
                            blurRadius: 10,
                          ),
                        ]
                      : null,
                ),
                child: UserAvatar(
                  avatarUrl: user?.avatarUrl,
                  name: user?.name ?? 'User',
                  size: 20,
                  isVerified: false,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: isActive ? AppColors.brandOrangeLight : inactiveColor,
                  fontSize: 9.5,
                  fontWeight: isActive ? FontWeight.w900 : FontWeight.w500,
                  shadows: isActive
                      ? [
                          Shadow(
                            color: AppColors.brandOrange.withValues(
                              alpha: 0.70,
                            ),
                            blurRadius: 8,
                          ),
                        ]
                      : null,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCreateButton(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => showCreateMenuPopup(context),
      child: Container(
        width: 40,
        height: 40,
        margin: const EdgeInsets.symmetric(horizontal: 5),
        decoration: BoxDecoration(
          gradient: AppColors.createGradient,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: AppColors.brandOrange.withValues(alpha: 0.35),
              blurRadius: 15,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: const Icon(Icons.add, color: Color(0xFF0F172A), size: 24),
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
  late Future<List<Short>> _shortsFuture;
  late Future<Map<String, String>> _feedbackFuture;

  /// Incremented on every pull-to-refresh and handed to child shelves that
  /// own their own fetch rather than reading one of the futures above.
  /// TrendingNowRow is the one that needs it — it lives inside HomePage's
  /// IndexedStack, so it is built once and kept alive for the whole session,
  /// and without a signal like this it never re-fetched at all.
  int _feedRefreshTick = 0;

  @override
  void initState() {
    super.initState();
    final videoService = ref.read(videoServiceProvider);
    _videosFuture = videoService.getVideos();
    _featuredFuture = videoService.getFeaturedWeekly();
    _shortsFuture = videoService.getShorts();
    // Loaded once here and passed down to every VideoCard, matching
    // RecommendationFeed.tsx's own `feedbackMap` — so 20+ cards on one
    // screen share a single request instead of each firing its own.
    _feedbackFuture = ref
        .read(videoInteractionServiceProvider)
        .getFeedbackMap();
  }

  Future<void> _refreshContent() async {
    final videoService = ref.read(videoServiceProvider);
    setState(() {
      _videosFuture = videoService.getVideos();
      _featuredFuture = videoService.getFeaturedWeekly();
      _shortsFuture = videoService.getShorts();
      _feedbackFuture = ref
          .read(videoInteractionServiceProvider)
          .getFeedbackMap();
      _feedRefreshTick++;
    });
    await Future.wait([
      _videosFuture,
      _featuredFuture,
      _shortsFuture,
      _feedbackFuture,
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: context.bgCard,
      onRefresh: _refreshContent,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverAppBar(
            automaticallyImplyLeading: false,
            floating: true,
            snap: true,
            backgroundColor:
                (isDark ? AppColors.backgroundDark : AppColors.backgroundLight)
                    .withValues(alpha: 0.95),
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            toolbarHeight: 72,
            titleSpacing: 16,
            flexibleSpace: Container(
              color: Colors.transparent,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Text(
                    'INPLAYER',
                    style: TextStyle(
                      fontSize: 54,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 18.9,
                      color: context.textPrimary.withValues(alpha: 0.04),
                    ),
                  ),
                ],
              ),
            ),
            title: Row(
              children: [
                Builder(
                  builder: (ctx) => GestureDetector(
                    onTap: () => Scaffold.of(ctx).openDrawer(),
                    child: Container(
                      width: 38,
                      height: 38,
                      margin: const EdgeInsets.only(right: 10),
                      decoration: BoxDecoration(
                        color: context.textPrimary.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: context.borderSubtle),
                      ),
                      child: Icon(
                        Icons.menu,
                        color: context.textPrimary,
                        size: 20,
                      ),
                    ),
                  ),
                ),
                // No wrapping GestureDetector here any more: AppNavbarLogo
                // has its own, and nesting two meant only the inner one ever
                // fired — so this category reset silently never ran, while
                // the logo's own context.go('/') did. This navbar only
                // exists on the home route, so that was navigating to the
                // page we are already on, which makes go_router tear down
                // and rebuild the entire shell: tab index reset, whole feed
                // refetched, everything flashing. Tapping the logo while
                // already home should just clear the category filter.
                AppNavbarLogo(
                  height: 32,
                  onTap: () {
                    if (_selectedCategory != 'All') {
                      setState(() => _selectedCategory = 'All');
                    }
                  },
                ),
                const Spacer(),
                _buildHeaderIcon(Icons.search, () => context.push('/search')),
                _buildHeaderIcon(
                  Icons.notifications_outlined,
                  () => context.push('/notifications'),
                  showBadge: ref.watch(
                    notificationBadgeServiceProvider.select(
                      (s) => s.unreadCount > 0,
                    ),
                  ),
                ),
              ],
            ),
          ),
          SliverToBoxAdapter(child: _buildHomeContent()),
          const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ],
      ),
    );
  }

  Widget _buildHeaderIcon(
    IconData icon,
    VoidCallback onTap, {
    bool showBadge = false,
  }) {
    return Container(
      margin: const EdgeInsets.only(left: 8),
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: context.textPrimary.withValues(alpha: 0.05),
        shape: BoxShape.circle,
        border: Border.all(color: context.borderSubtle),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          IconButton(
            padding: EdgeInsets.zero,
            icon: Icon(icon, color: context.textPrimary, size: 20),
            onPressed: onTap,
          ),
          // Small red-dot unread badge — matches the website's real bell
          // (NavbarActions.tsx) exactly: a plain dot, not a count.
          if (showBadge)
            Positioned(
              right: 8,
              top: 8,
              child: IgnorePointer(
                child: Container(
                  width: 9,
                  height: 9,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444),
                    shape: BoxShape.circle,
                    border: Border.all(color: context.bgCanvas, width: 1.5),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Every home surface runs its list through this.
  ///
  /// Music tracks are uploaded into the same collection as everything else,
  /// so /api/videos and /api/featured-weekly hand them back mixed in with
  /// ordinary video rows. Without this filter a track like a devotional
  /// song renders as a plain 7-minute "video" card in the middle of the
  /// feed — which is exactly what it was doing.
  ///
  /// Music belongs to the dedicated Music tab and nowhere else on home.
  /// Applying the filter here rather than inside VideoService.getVideos()
  /// is deliberate: getVideos() is shared with search, channel pages, the
  /// Music tab itself and the "Music" category chip, all of which
  /// legitimately need music rows. The exclusion is a property of the home
  /// feed, not of the data layer, so it lives with the home feed.
  static List<Video> _withoutMusic(List<Video> videos) =>
      videos.where((v) => !v.isMusic).toList();

  Widget _buildHomeContent() {
    return FutureBuilder<List<Video>>(
      future: _videosFuture,
      builder: (context, videoSnapshot) {
        if (videoSnapshot.connectionState == ConnectionState.waiting) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 80),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircularProgressIndicator(color: AppColors.brandOrange),
                  const SizedBox(height: 16),
                  Text(
                    'Loading videos...',
                    style: TextStyle(color: context.textSecondary),
                  ),
                ],
              ),
            ),
          );
        }

        if (videoSnapshot.hasError) {
          return _buildErrorState();
        }

        final videos = _withoutMusic(videoSnapshot.data ?? []);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildCategoryChips(),
            _buildFeaturedFromBackend(),
            const SizedBox(height: 16),
            if (videos.isEmpty)
              _buildEmptyState()
            else
              _buildRhythmFeed(videos),
          ],
        );
      },
    );
  }

  /// The real home feed shelf rhythm — mirrors
  /// RecommendationFeed.tsx: videos in blocks of 4, with
  /// TrendingNow after the first block, the InJoy games shelf after the
  /// second, and a Raftaar Shorts shelf after every odd block (using a
  /// cursor that only advances when a shelf actually gets content, so a
  /// short shorts list doesn't leave later shelves empty). Kids/Music
  /// shelves come from the same already-fetched video list ([Video.audience]
  /// / [Video.isMusic]), matching getRealContent() on the website rather
  /// than a separate endpoint. The website also inserts one ad slot at a
  /// random position among the visible items — this app places it once,
  /// after the first block, a deliberate simplification of that
  /// randomness rather than a missed feature.
  Widget _buildRhythmFeed(List<Video> videos) {
    const blockSize = 4;
    const shortsPerShelf = 8;

    final kidsVideos = videos.where((v) => v.audience == 'kids').toList();

    final blocks = <List<Video>>[];
    for (var i = 0; i < videos.length; i += blockSize) {
      blocks.add(
        videos.sublist(
          i,
          i + blockSize > videos.length ? videos.length : i + blockSize,
        ),
      );
    }

    return FutureBuilder<List<Object>>(
      // Combined so the shelf rhythm only rebuilds once both the shorts
      // list (for the repeating Raftaar shelves) and the feedback map
      // (for every VideoCard's Interested/Not Interested state) are in,
      // rather than flashing an unfed state for one and not the other.
      future: Future.wait([_shortsFuture, _feedbackFuture]),
      builder: (context, snapshot) {
        final results = snapshot.data;
        final allShorts = results != null
            ? results[0] as List<Short>
            : const <Short>[];
        final feedbackMap = results != null
            ? results[1] as Map<String, String>
            : const <String, String>{};

        int shelfCursor = 0;
        final widgets = <Widget>[];

        if (kidsVideos.isNotEmpty) {
          widgets.add(KidsRow(videos: kidsVideos));
          widgets.add(const SizedBox(height: 12));
        }

        for (var blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
          widgets.add(_buildVideoGrid(blocks[blockIndex], feedbackMap));
          widgets.add(const SizedBox(height: 12));

          if (blockIndex == 0) {
            widgets.add(const HomeAdCard());
            widgets.add(const SizedBox(height: 12));
            widgets.add(TrendingNowRow(refreshToken: _feedRefreshTick));
            widgets.add(const SizedBox(height: 12));
          }
          if (blockIndex == 1) {
            widgets.add(const PlayablesShelf());
            widgets.add(const SizedBox(height: 12));
          }

          if (blockIndex.isOdd && shelfCursor < allShorts.length) {
            final end = (shelfCursor + shortsPerShelf > allShorts.length)
                ? allShorts.length
                : shelfCursor + shortsPerShelf;
            final slice = allShorts.sublist(shelfCursor, end);
            if (slice.isNotEmpty) {
              widgets.add(
                RaftaarShortsRow(
                  shorts: slice,
                  title: shelfCursor == 0
                      ? 'Raftaar Shorts'
                      : 'More Raftaar Shorts',
                ),
              );
              widgets.add(const SizedBox(height: 12));
              shelfCursor = end;
            }
          }
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: widgets,
        );
      },
    );
  }

  String _selectedCategory = 'All';

  // The first two are ORIENTATION toggles, not topical categories — this
  // matches the website's own NavigationCategories.tsx exactly ("All" =
  // the normal horizontal feed you're already looking at; "Verticals" =
  // the vertical/Shorts view, which on this app is the dedicated Raftaar
  // tab rather than a same-page view switch). Everything after the divider
  // is a real topical category from app/data/categories.ts
  // (CONTENT_CATEGORIES) — the single source of truth shared with the
  // website's own category bar and upload form, so this list can't drift
  // out of sync with what a category chip actually needs to match on
  // video.category. The previous list here was 13 items, several invented
  // ("InPlay Originals" isn't a real category) and the rest incomplete;
  // this is the real 30.
  static const List<String> _topicalCategories = [
    'Entertainment',
    'Movies',
    'Web Series',
    'Raftaar (Vertical Videos)',
    'Music',
    'Podcasts',
    'Gaming',
    'Education',
    'Business & Finance',
    'Technology',
    'News & Politics',
    'Sports',
    'Food & Cooking',
    'Travel & Vlogs',
    'Fashion & Beauty',
    'Health & Fitness',
    'Comedy',
    'Drama',
    'Romance',
    'Horror',
    'Crime & Mystery',
    'Kids',
    'Pets & Animals',
    'Science',
    'Art & Design',
    'DIY & Crafts',
    'Automobiles',
    'Home & Lifestyle',
    'Agriculture',
    'Devotional',
    'Live Streams',
  ];

  void _onCategoryChipTap(String cat) {
    setState(() => _selectedCategory = cat);
    if (cat == 'All') {
      // Already the view you're looking at — matches the website, where
      // this chip is just a link back to "/".
      return;
    }
    if (cat == 'Verticals') {
      // The website switches the home feed's own orientation in place;
      // this app already has that same content as a dedicated tab.
      context.go('/shorts');
      return;
    }
    context.push('/category/${Uri.encodeComponent(cat)}');
  }

  Widget _buildCategoryChips() {
    final categories = ['All', 'Verticals', ..._topicalCategories];
    final isDark = context.isDark;

    return Container(
      height: 40,
      margin: const EdgeInsets.only(top: 2, bottom: 8),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        itemCount: categories.length,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final cat = categories[index];
          final isSelected = _selectedCategory == cat;

          final activeBg = isDark ? Colors.white : const Color(0xFF0F172A);
          final activeText = isDark ? const Color(0xFF0F172A) : Colors.white;
          final idleBg = isDark
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.black.withValues(alpha: 0.05);
          final idleBorder = isDark
              ? Colors.white.withValues(alpha: 0.12)
              : Colors.black.withValues(alpha: 0.08);
          final idleText = isDark ? Colors.white : const Color(0xFF1E293B);

          return Center(
            child: GestureDetector(
              onTap: () => _onCategoryChipTap(cat),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: isSelected ? activeBg : idleBg,
                  borderRadius: BorderRadius.circular(8),
                  border: isSelected ? null : Border.all(color: idleBorder),
                ),
                child: Text(
                  cat,
                  style: TextStyle(
                    color: isSelected ? activeText : idleText,
                    fontSize: 12.5,
                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
            ),
          );
        },
      ),
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
        final featuredVideos = _withoutMusic(snapshot.data ?? []);
        if (featuredVideos.isEmpty) {
          return const SizedBox.shrink();
        }
        return FeaturedHeroCarousel(featuredVideos: featuredVideos);
      },
    );
  }

  Widget _buildVideoGrid(
    List<Video> videos, [
    Map<String, String> feedbackMap = const {},
  ]) {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: videos.length,
      separatorBuilder: (context, index) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final video = videos[index];
        return VideoCard(
          video: video,
          initialFeedback: feedbackMap[video.videoId],
        );
      },
    );
  }

  Widget _buildErrorState() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 80),
      child: Column(
        children: [
          Icon(
            Icons.cloud_off_outlined,
            size: 56,
            color: context.textSecondary,
          ),
          const SizedBox(height: 18),
          Text(
            'Unable to load videos',
            style: TextStyle(
              color: context.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Please check your connection and try again.',
            textAlign: TextAlign.center,
            style: TextStyle(color: context.textSecondary, fontSize: 14),
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
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 70),
      child: Column(
        children: [
          Icon(
            Icons.video_library_outlined,
            size: 60,
            color: context.textSecondary.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 16),
          Text(
            'No videos available',
            style: TextStyle(
              color: context.textPrimary,
              fontSize: 17,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'New videos will appear here when they are published.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: context.textSecondary.withValues(alpha: 0.8),
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}
