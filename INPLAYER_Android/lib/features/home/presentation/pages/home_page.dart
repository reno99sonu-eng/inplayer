import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
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
import '../../../raftaar_films/presentation/pages/raftaar_films_landing_page.dart';
import '../../../upload/presentation/pages/upload_page.dart';
import '../widgets/video_card.dart';
import '../widgets/featured_hero_carousel.dart';
import '../widgets/floating_ai_button.dart';
import '../widgets/in_family_row.dart';
import '../widgets/raftaar_shorts_row.dart';
import '../widgets/playables_shelf.dart';
import '../widgets/home_ad_card.dart';
import '../widgets/full_screen_announcement.dart';
import '../../../music/presentation/widgets/mini_player_bar.dart';
import '../../../../services/music_player_service.dart';
import '../../../../services/platform_settings_service.dart';
import '../../../../services/navbar_theme_service.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../core/utils/video_preview_gate.dart';
import '../../../../models/admin_navbar_theme.dart';
import '../../../../services/content_access_service.dart';
import '../../../../services/platform_update_service.dart';
import '../../../../core/router/pageless_route_observer.dart';
import '../../../../models/short.dart';
import '../../../../services/video_interaction_service.dart';
import '../../../../services/video_mini_player_service.dart';
import '../../../../services/ad_service.dart';
import '../../../../services/premium_service.dart';
import '../widgets/mobile_menu_drawer.dart';
import '../widgets/profile_menu_modal.dart';
import '../widgets/create_menu_popup.dart';
import '../../../auth/presentation/widgets/auth_modals.dart';
import '../../../../core/widgets/notification_permission_helper.dart';
import '../../../../core/widgets/pattern_background.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../models/user.dart';
import '../../../../core/utils/responsive.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  /// Per-session dismissal of the admin's announcement banner. Deliberately
  /// not persisted: if an admin puts a notice up, it should come back on the
  /// next launch until they take it down.
  bool _announcementDismissed = false;
  String? _lastAnnouncementText;
  bool _exitingApp = false;
  int _currentIndex = 0;
  final Set<int> _builtTabs = <int>{0};

  Future<void> _exitApp() async {
    if (_exitingApp) return;
    _exitingApp = true;

    // The app-wide video window and JustAudioBackground intentionally keep
    // playback alive while the viewer moves between screens or backgrounds
    // the app. A deliberate Back press from the root Home tab is the exit
    // path, so release both playback sessions before finishing the Activity.
    try {
      await Future.wait([
        ref.read(videoMiniPlayerServiceProvider).closeAndWait(),
        ref.read(musicPlayerServiceProvider).stop(),
      ]);
    } catch (error, stackTrace) {
      debugPrint(
        'Playback cleanup before app exit failed: $error\n$stackTrace',
      );
    } finally {
      if (mounted) await SystemNavigator.pop();
    }
  }

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
    required bool feedSurfacesActive,
    required double shortsBottomInset,
    required double filmsBottomInset,
    required int contentAccessRevision,
    required int platformUpdateRevision,
    required String feedRevision,
  }) {
    return [
      _builtTabs.contains(0)
          ? HomeFeedPage(
              // Keep feed state and previews alive across data revisions;
              // HomeFeedPage refreshes the list in place.
              key: const ValueKey('home-feed'),
              isActive: _currentIndex == 0 && feedSurfacesActive,
              contentAccessRevision: contentAccessRevision,
              platformUpdateRevision: platformUpdateRevision,
            )
          : const SizedBox.shrink(),
      _builtTabs.contains(1)
          ? ShortsPage(
              // Stable key on purpose. Folding feedRevision in here meant
              // every content-access/platform-update bump destroyed and
              // rebuilt the whole Raftaar feed — killing the video mid-play
              // — which is what made opening it from the nav bar flicker.
              // The revision now goes in as a field and the feed refreshes
              // its own list instead. See ShortsPage.feedRevision.
              key: const ValueKey('shorts'),
              feedRevision: feedRevision,
              isActive: _currentIndex == _raftaarTab && feedSurfacesActive,
              bottomInset: shortsBottomInset,
              // Nothing to pop here — Raftaar is a tab, not a pushed route — so
              // "back" means returning to the Home tab.
              onExit: () => _selectTab(0),
            )
          : const SizedBox.shrink(),
      _builtTabs.contains(2) ? const UploadPage() : const SizedBox.shrink(),
      _builtTabs.contains(3)
          ? RaftaarFilmsLandingPage(bottomInset: filmsBottomInset)
          : const SizedBox.shrink(),
      _builtTabs.contains(4) ? const ProfilePage() : const SizedBox.shrink(),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final homeRoute = ModalRoute.of(context);
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
    final filmsBottomInset =
        _bottomNavInset + (musicLoaded ? _miniPlayerInset : 0.0);

    // Platform-wide switches written by the admin panel. `.value ?? normal`
    // is the fail-open rule: while the request is in flight, and if it
    // never lands at all, the app behaves as though everything is running
    // — a settings fetch that times out must never be able to show a
    // maintenance screen over a platform that is actually fine.
    final platformSettings =
        ref.watch(publicPlatformSettingsProvider).value ??
        PublicPlatformSettings.normal;

    if (platformSettings.announcementText != _lastAnnouncementText) {
      _lastAnnouncementText = platformSettings.announcementText;
      _announcementDismissed = false;
    }

    final showAnnouncement =
        _currentIndex == 0 &&
        platformSettings.announcementEnabled &&
        platformSettings.announcementText.isNotEmpty &&
        !_announcementDismissed &&
        !platformSettings.maintenanceMode;

    return PopScope(
      // Intercept Back even on the Home tab so active audio/video sessions are
      // stopped before the Android Activity is finished.
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        if (showAnnouncement) {
          setState(() => _announcementDismissed = true);
        } else if (_currentIndex != 0) {
          setState(() {
            _currentIndex = 0;
          });
        } else {
          unawaited(_exitApp());
        }
      },
      child: Scaffold(
        extendBody: true,
        backgroundColor: Colors.transparent,
        drawer: const MobileMenuDrawer(),
        // The app-level floating video window hides while the drawer is open
        // (it floats above the Navigator, so it would cover the menu rows).
        onDrawerChanged: (open) =>
            pagelessRouteObserver.drawerOpen.value = open,
        body: PatternBackground(
          child: Stack(
            children: [
              ValueListenableBuilder<Route<dynamic>?>(
                valueListenable: pagelessRouteObserver.topRoute,
                builder: (context, topRoute, _) => ValueListenableBuilder<bool>(
                  valueListenable: pagelessRouteObserver.drawerOpen,
                  builder: (context, drawerOpen, _) {
                    final isTopRoute =
                        topRoute == null || identical(topRoute, homeRoute);
                    final feedSurfacesActive =
                        isTopRoute &&
                        !drawerOpen &&
                        !showAnnouncement &&
                        !platformSettings.maintenanceMode;
                    return IndexedStack(
                      index: _currentIndex,
                      children: _buildPages(
                        feedSurfacesActive: feedSurfacesActive,
                        shortsBottomInset: shortsBottomInset,
                        filmsBottomInset: filmsBottomInset,
                        contentAccessRevision: contentAccessRevision,
                        platformUpdateRevision: platformUpdateRevision,
                        feedRevision: feedRevision,
                      ),
                    );
                  },
                ),
              ),
              // Home tab only. Previously mounted above the router in
              // main.dart, which put it over every screen in the app.
              if (_currentIndex == 0)
                FloatingAIButton(
                  bottomInset: 88 + (musicLoaded ? _miniPlayerInset : 0.0),
                ),
              // The floating video window (VideoMiniPlayerOverlay) is mounted
              // app-wide in main.dart so it survives pages pushed over Home.
              if (showAnnouncement)
                FullScreenAnnouncement(
                  message: platformSettings.announcementText,
                  linkUrl: platformSettings.announcementLinkUrl,
                  onClose: () => setState(() => _announcementDismissed = true),
                ),
              // Last in the Stack so it covers everything above, including the
              // nav shell. Note this covers the TAB shell — a screen pushed on
              // top of it (a watch page opened from a deep link) sits above
              // this and is not blocked.
              if (platformSettings.maintenanceMode)
                _buildMaintenanceOverlay(platformSettings),
            ],
          ),
        ),
        bottomNavigationBar: showAnnouncement
            ? null
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const MiniPlayerBar(),
                  _buildBottomNavigationBar(context),
                ],
              ),
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
  /// Shown when the admin switches InPlayer into maintenance mode, using
  /// their own message rather than a generic one.
  Widget _buildMaintenanceOverlay(PublicPlatformSettings settings) {
    final message = settings.maintenanceMessage.isNotEmpty
        ? settings.maintenanceMessage
        : 'InPlayer is down for maintenance right now. Please check back '
              'shortly.';
    return Positioned.fill(
      child: ColoredBox(
        color: context.bgCanvas,
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.construction_rounded,
                    size: 52,
                    color: AppColors.brandOrange,
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Back shortly',
                    style: TextStyle(
                      color: context.textPrimary,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    message,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: context.textSecondary,
                      fontSize: 13.5,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 22),
                  OutlinedButton(
                    onPressed: () =>
                        ref.invalidate(publicPlatformSettingsProvider),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.brandOrange),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 22,
                        vertical: 12,
                      ),
                    ),
                    child: const Text(
                      'Check again',
                      style: TextStyle(
                        color: AppColors.brandOrange,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

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
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 600),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildNavItem(0, Icons.home_outlined, 'Home', context),
                    _buildNavItem(
                      1,
                      Icons.play_circle_outline,
                      'Raftaar',
                      context,
                    ),
                    _buildCreateButton(context),
                    _buildNavItem(
                      3,
                      Icons.movie_filter_outlined,
                      'Films',
                      context,
                    ),
                    _buildYouNavItem(4, 'You', context, user),
                  ],
                ),
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
                  key: ValueKey<String>(user?.avatarUrl ?? 'guest-avatar'),
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

enum _HomeFeedEntryKind { videoRow, ad, family, playables, raftaarShorts }

class _HomeFeedEntry {
  final String key;
  final _HomeFeedEntryKind kind;
  final List<Video> videos;
  final List<Short> shorts;
  final String title;
  final double bottomSpacing;

  const _HomeFeedEntry({
    required this.key,
    required this.kind,
    this.videos = const [],
    this.shorts = const [],
    this.title = '',
    this.bottomSpacing = 0,
  });
}

class HomeFeedPage extends ConsumerStatefulWidget {
  const HomeFeedPage({
    super.key,
    this.isActive = true,
    this.contentAccessRevision = 0,
    this.platformUpdateRevision = 0,
  });

  final bool isActive;
  final int contentAccessRevision;
  final int platformUpdateRevision;

  @override
  ConsumerState<HomeFeedPage> createState() => _HomeFeedPageState();
}

class _HomeFeedPageState extends ConsumerState<HomeFeedPage>
    with WidgetsBindingObserver {
  static const int _homePageSize = 24;
  static const double _loadMoreThreshold = 960;

  final ScrollController _feedScrollController = ScrollController();
  List<Video>? _videos;
  List<Video> _featured = const [];
  List<Short> _shorts = const [];
  Map<String, String> _feedback = const {};
  bool _feedLoading = true;
  bool _feedFailed = false;
  bool _hasMoreVideos = true;
  bool _loadingMoreVideos = false;
  bool _loadMoreFailed = false;
  int _nextVideoOffset = 0;
  int _feedRequestId = 0;

  /// Incremented on every pull-to-refresh and handed to child shelves that
  /// own their own fetch rather than reading one of the futures above.
  int _feedRefreshTick = 0;
  bool _previewsSuspended = false;

  void _setPreviewSuspension(bool suspended) {
    if (suspended == _previewsSuspended) return;
    _previewsSuspended = suspended;
    if (suspended) {
      VideoPreviewGate.instance.suspend();
    } else {
      VideoPreviewGate.instance.resume();
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _feedScrollController.addListener(_onFeedScroll);
    _setPreviewSuspension(
      !widget.isActive ||
          WidgetsBinding.instance.lifecycleState != AppLifecycleState.resumed,
    );
    unawaited(_loadFeedData());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(_preloadMidrollCreative());
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _feedScrollController
      ..removeListener(_onFeedScroll)
      ..dispose();
    _setPreviewSuspension(false);
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant HomeFeedPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isActive != widget.isActive) {
      _setPreviewSuspension(
        !widget.isActive ||
            WidgetsBinding.instance.lifecycleState != AppLifecycleState.resumed,
      );
      if (widget.isActive) _scheduleLoadMoreCheck();
    }

    if (oldWidget.contentAccessRevision != widget.contentAccessRevision) {
      // Audience/access changes can make previously visible items
      // unavailable, so clear those before fetching the newly permitted set.
      // The page itself stays mounted, preserving its scroll position.
      _videos = null;
      _featured = const [];
      _shorts = const [];
      _feedback = const {};
      _feedLoading = true;
      _feedFailed = false;
      _hasMoreVideos = true;
      _nextVideoOffset = 0;
      _loadingMoreVideos = false;
      _loadMoreFailed = false;
      unawaited(_loadFeedData(forceRefresh: true));
    } else if (oldWidget.platformUpdateRevision !=
        widget.platformUpdateRevision) {
      // Keep the current feed visible while a background platform refresh
      // replaces it, rather than blanking the page during every update.
      unawaited(_loadFeedData(forceRefresh: true));
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) {
      _setPreviewSuspension(true);
      return;
    }
    _setPreviewSuspension(!widget.isActive);
    ref.invalidate(publicPlatformSettingsProvider);
    ref.invalidate(publicNavbarThemeProvider);
    unawaited(_preloadMidrollCreative());
    if (widget.isActive) unawaited(_refreshContent());
  }

  Future<void> _preloadMidrollCreative() async {
    // Resolve account-specific ad eligibility while the viewer is still on
    // the feed, instead of putting the premium check on the tap-to-play path.
    unawaited(ref.read(premiumServiceProvider).getStatus());
    final config = await ref.read(adServiceProvider).getMidrollConfig();
    if (!mounted || config == null || !config.enabled) return;
    final ad = config.ad ?? (config.ads.isNotEmpty ? config.ads.first : null);
    if (ad == null) return;
    final provider = smartImageProvider(ad.imageUrl);
    if (provider == null) return;
    try {
      await precacheImage(provider, context);
    } catch (_) {
      // The player retries the actual creative when its pre-roll starts.
    }
  }

  Future<void> _loadFeedData({bool forceRefresh = false}) async {
    final requestId = ++_feedRequestId;
    final videoService = ref.read(videoServiceProvider);
    final feedbackService = ref.read(videoInteractionServiceProvider);

    _loadingMoreVideos = false;
    _loadMoreFailed = false;
    final videosFuture = videoService.getVideosPage(
      offset: 0,
      limit: _homePageSize,
    );
    final featuredFuture = videoService.getFeaturedWeekly(
      forceRefresh: forceRefresh,
    );
    final feedbackFuture = feedbackService.getFeedbackMap();
    final shortsFuture = videoService.getShorts(forceRefresh: forceRefresh);

    // The shelves decorate the feed and never hold the main rows behind their
    // requests. Start independent calls together so late shelf insertion is
    // less likely to move the feed while someone is already scrolling.
    unawaited(_loadFeatured(featuredFuture, requestId));
    unawaited(_loadFeedback(feedbackFuture, requestId));
    unawaited(_loadShorts(shortsFuture, requestId));

    try {
      final page = await videosFuture;
      if (!mounted || requestId != _feedRequestId) return;
      setState(() {
        final existingVideos = _videos;
        if (existingVideos == null || _nextVideoOffset == 0) {
          _videos = page.videos;
          _nextVideoOffset = page.nextOffset;
        } else {
          // Revalidation keeps already loaded older rows and the scroll
          // position. New uploads from page zero are merged at the front.
          final seenIds = page.videos.map((video) => video.videoId).toSet();
          _videos = [
            ...page.videos,
            ...existingVideos.where(
              (video) => !seenIds.contains(video.videoId),
            ),
          ];
        }
        _hasMoreVideos = page.hasMore || _nextVideoOffset < page.total;
        _feedLoading = false;
        _feedFailed = false;
      });
      _scheduleLoadMoreCheck();
    } catch (_) {
      if (!mounted || requestId != _feedRequestId) return;
      setState(() {
        _feedLoading = false;
        // A failed background refresh must not replace an already loaded
        // feed with an error state.
        _feedFailed = _videos == null;
      });
    }
  }

  void _onFeedScroll() {
    if (!widget.isActive || !_feedScrollController.hasClients) return;
    if (_feedScrollController.position.extentAfter < _loadMoreThreshold) {
      unawaited(_loadMoreVideos());
    }
  }

  void _scheduleLoadMoreCheck() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _onFeedScroll();
    });
  }

  Future<void> _loadMoreVideos() async {
    if (!widget.isActive ||
        _videos == null ||
        !_hasMoreVideos ||
        _loadingMoreVideos ||
        _loadMoreFailed) {
      return;
    }

    final requestId = _feedRequestId;
    final offset = _nextVideoOffset;
    setState(() => _loadingMoreVideos = true);

    VideoPage? page;
    try {
      page = await ref
          .read(videoServiceProvider)
          .getVideosPage(offset: offset, limit: _homePageSize);
    } catch (error) {
      debugPrint('Home feed next page failed at offset $offset: $error');
    }

    if (!mounted || requestId != _feedRequestId) return;
    final loadedPage = page;
    setState(() {
      if (loadedPage != null) {
        final existingIds = _videos!.map((video) => video.videoId).toSet();
        _videos = [
          ..._videos!,
          ...loadedPage.videos.where(
            (video) => !existingIds.contains(video.videoId),
          ),
        ];
        _nextVideoOffset = loadedPage.nextOffset;
        _hasMoreVideos = loadedPage.hasMore;
      } else {
        _loadMoreFailed = true;
      }
      _loadingMoreVideos = false;
    });
    if (loadedPage != null) _scheduleLoadMoreCheck();
  }

  Future<void> _loadFeatured(Future<List<Video>> future, int requestId) async {
    try {
      final featured = await future;
      if (!mounted || requestId != _feedRequestId) return;
      setState(() => _featured = featured);
    } catch (_) {
      // Featured content is optional; the core video grid remains available.
    }
  }

  Future<void> _loadShorts(Future<List<Short>> future, int requestId) async {
    try {
      final shorts = await future;
      if (!mounted || requestId != _feedRequestId) return;
      setState(() => _shorts = shorts);
    } catch (_) {
      // The horizontal Shorts shelf is optional to the main feed.
    }
  }

  Future<void> _loadFeedback(
    Future<Map<String, String>> future,
    int requestId,
  ) async {
    try {
      final feedback = await future;
      if (!mounted || requestId != _feedRequestId) return;
      setState(() => _feedback = feedback);
    } catch (_) {
      // Video feedback badges can load later or remain at their defaults.
    }
  }

  Future<void> _refreshContent() async {
    setState(() => _feedRefreshTick++);
    ref.invalidate(publicPlatformSettingsProvider);
    ref.invalidate(publicNavbarThemeProvider);
    await _loadFeedData(forceRefresh: true);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;

    // The occasion navbar theme an admin can turn on from the admin panel
    // (Diwali, Independence Day, etc.) — see navbar_theme_service.dart.
    // `.value` on a still-loading/failed FutureProvider is just null,
    // which already means "show nothing," so no separate fallback is
    // needed.
    final navbarTheme = ref.watch(publicNavbarThemeProvider).value;

    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: context.bgCard,
      onRefresh: _refreshContent,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        controller: _feedScrollController,
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
                _buildNavbarThemeBadge(navbarTheme),
                const Spacer(),
                _buildHeaderIcon(
                  Icons.music_note_rounded,
                  () => context.push('/music'),
                ),
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
          ..._buildHomeSlivers(),
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

  /// Site-wide occasion navbar theme (e.g. a Diwali/Independence Day
  /// graphic an admin turned on from the admin panel or the website).
  /// Mirrors what Navbar.tsx shows next to the logo on the website — before
  /// this, an admin could set a theme from the app's own admin screen, and
  /// it would show on the website, but a regular app user would never see
  /// it because nothing ever rendered it here.
  ///
  /// Deliberately image-only, no accompanying text: the app bar's Row has
  /// far less horizontal room than the website's desktop navbar, and this
  /// same screen already had a real mobile-overflow bug (see the email/ID
  /// text-wrapping fixes elsewhere in this session) — adding a second
  /// stacked-text block here would risk reintroducing exactly that. A
  /// small height-capped image can never push the search/notification
  /// icons off-screen the way unbounded text could.
  Widget _buildNavbarThemeBadge(AdminNavbarTheme? theme) {
    if (theme == null || !theme.active || theme.imageUrl.isEmpty) {
      return const SizedBox.shrink();
    }
    final provider = smartImageProvider(theme.imageUrl);
    if (provider == null) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 60, maxHeight: 32),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: Image(
            image: provider,
            height: 32,
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) =>
                const SizedBox.shrink(),
          ),
        ),
      ),
    );
  }

  /// Every home surface runs its list through this.
  ///
  /// Explicit Music uploads share the same collection as videos, so the
  /// video endpoints can return both. Filter by contentType, not category:
  /// a regular video tagged with the Music category is still a video.
  ///
  /// Music tracks belong to the dedicated Music tab and nowhere else on home.
  /// Applying the filter here rather than inside VideoService.getVideos()
  /// is deliberate: getVideos() is shared with search, channel pages, the
  /// Filters out Music tracks and Raftaar Shorts from the main long-form video feed.
  ///
  /// Longform videos belong on the main feed grid, Raftaar Shorts belong in
  /// the dedicated Raftaar tab and horizontal Raftaar shelf, and explicit
  /// Music uploads belong in the dedicated Music tab.
  static List<Video> _onlyLongformVideos(List<Video> videos) =>
      videos.where((v) => !v.isStrictMusic && !v.isShort && !v.isFilm).toList();

  List<Widget> _buildHomeSlivers() {
    if (_videos == null && _feedLoading) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Padding(
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
          ),
        ),
      ];
    }

    if (_videos == null && _feedFailed) {
      return [
        SliverFillRemaining(hasScrollBody: false, child: _buildErrorState()),
      ];
    }
    if (_videos == null) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: CircularProgressIndicator(color: AppColors.brandOrange),
          ),
        ),
      ];
    }

    final videos = _onlyLongformVideos(_videos!);
    final featured = _onlyLongformVideos(_featured);

    return [
      SliverToBoxAdapter(child: _buildCategoryChips()),
      SliverToBoxAdapter(
        child: FeaturedHeroCarousel(featuredVideos: featured),
      ),
      const SliverToBoxAdapter(child: SizedBox(height: 16)),
      if (videos.isEmpty)
        SliverToBoxAdapter(child: _buildEmptyState())
      else
        _buildRhythmFeedSliver(videos, _shorts, _feedback),
      if (_loadingMoreVideos)
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: SizedBox.square(
                dimension: 24,
                child: CircularProgressIndicator(strokeWidth: 2.5),
              ),
            ),
          ),
        ),
      if (_loadMoreFailed)
        SliverToBoxAdapter(
          child: Center(
            child: TextButton.icon(
              onPressed: () {
                setState(() => _loadMoreFailed = false);
                unawaited(_loadMoreVideos());
              },
              icon: const Icon(Icons.refresh),
              label: const Text('Could not load more videos. Retry'),
            ),
          ),
        ),
    ];
  }

  /// The real home feed shelf rhythm — mirrors
  /// RecommendationFeed.tsx: videos in blocks of 4, with
  /// TrendingNow after the first block, the InJoy games shelf after the
  /// second, and a Raftaar Shorts shelf after every odd block.
  Widget _buildRhythmFeedSliver(
    List<Video> videos,
    List<Short> allShorts,
    Map<String, String> feedbackMap,
  ) {
    const blockSize = 4;
    const shortsPerShelf = 8;
    final columns = context.responsiveVideoColumns.clamp(1, 4).toInt();

    final entries = <_HomeFeedEntry>[];
    for (var i = 0; i < videos.length; i += blockSize) {
      final blockEnd = i + blockSize > videos.length
          ? videos.length
          : i + blockSize;
      final block = videos.sublist(i, blockEnd);
      for (var rowStart = 0; rowStart < block.length; rowStart += columns) {
        final rowEnd = rowStart + columns > block.length
            ? block.length
            : rowStart + columns;
        final row = block.sublist(rowStart, rowEnd);
        final isLastRow = rowEnd == block.length;
        entries.add(
          _HomeFeedEntry(
            key: 'video-row-${row.first.videoId}',
            kind: _HomeFeedEntryKind.videoRow,
            videos: row,
            bottomSpacing: isLastRow ? 12 : (columns == 1 ? 12 : 16),
          ),
        );
      }

      final blockIndex = i ~/ blockSize;
      if (blockIndex == 0) {
        entries.add(
          const _HomeFeedEntry(
            key: 'home-ad',
            kind: _HomeFeedEntryKind.ad,
            bottomSpacing: 12,
          ),
        );
        entries.add(
          const _HomeFeedEntry(
            key: 'in-family',
            kind: _HomeFeedEntryKind.family,
            bottomSpacing: 12,
          ),
        );
      }
      if (blockIndex == 1) {
        entries.add(
          const _HomeFeedEntry(
            key: 'playables',
            kind: _HomeFeedEntryKind.playables,
            bottomSpacing: 12,
          ),
        );
      }
      if (blockIndex == 2) {
        entries.add(
          const _HomeFeedEntry(
            key: 'home-ad-2',
            kind: _HomeFeedEntryKind.ad,
            bottomSpacing: 12,
          ),
        );
      }

      // Show Raftaar Shorts shelf right after block 0 (immediately below first videos),
      // and then repeat on alternate blocks so Raftaar is prominently visible
      final shelfCursor = _shortsConsumedBeforeBlock(blockIndex);
      if ((blockIndex == 0 || blockIndex.isEven) &&
          shelfCursor < allShorts.length) {
        final end = (shelfCursor + shortsPerShelf > allShorts.length)
            ? allShorts.length
            : shelfCursor + shortsPerShelf;
        final slice = allShorts.sublist(shelfCursor, end);
        if (slice.isNotEmpty) {
          entries.add(
            _HomeFeedEntry(
              key: 'raftaar-shorts-$shelfCursor',
              kind: _HomeFeedEntryKind.raftaarShorts,
              shorts: slice,
              title: shelfCursor == 0
                  ? 'Raftaar Shorts'
                  : 'More Raftaar Shorts',
              bottomSpacing: 12,
            ),
          );
        }
      }
    }

    final indexByKey = <String, int>{
      for (var index = 0; index < entries.length; index++)
        'home-feed-entry-${entries[index].key}': index,
    };

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          final entry = entries[index];
          return KeyedSubtree(
            key: ValueKey('home-feed-entry-${entry.key}'),
            child: _buildHomeFeedEntry(entry, feedbackMap, columns),
          );
        },
        childCount: entries.length,
        findChildIndexCallback: (key) =>
            key is ValueKey<String> ? indexByKey[key.value] : null,
      ),
    );
  }

  int _shortsConsumedBeforeBlock(int blockIndex) {
    // The current rhythm places one shelf after block 0, then each later
    // even-numbered block. Each full shelf consumes up to eight shorts.
    if (blockIndex == 0) return 0;
    var shelvesBefore = 1;
    for (var i = 2; i < blockIndex; i += 2) {
      shelvesBefore++;
    }
    return shelvesBefore * 8;
  }

  Widget _buildHomeFeedEntry(
    _HomeFeedEntry entry,
    Map<String, String> feedbackMap,
    int columns,
  ) {
    switch (entry.kind) {
      case _HomeFeedEntryKind.videoRow:
        final width = MediaQuery.of(context).size.width;
        final cellWidth = (width - 32 - (columns - 1) * 16) / columns;
        final cellHeight = columns == 1 ? null : cellWidth / 1.12;
        return Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, entry.bottomSpacing),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var index = 0; index < columns; index++) ...[
                if (index > 0) const SizedBox(width: 16),
                Expanded(
                  child: index < entry.videos.length
                      ? SizedBox(
                          height: cellHeight,
                          child: VideoCard(
                            key: ValueKey(entry.videos[index].videoId),
                            video: entry.videos[index],
                            initialFeedback:
                                feedbackMap[entry.videos[index].videoId],
                          ),
                        )
                      : SizedBox(height: cellHeight),
                ),
              ],
            ],
          ),
        );
      case _HomeFeedEntryKind.ad:
        return Padding(
          padding: EdgeInsets.only(bottom: entry.bottomSpacing),
          child: const HomeAdCard(),
        );
      case _HomeFeedEntryKind.family:
        return Padding(
          padding: EdgeInsets.only(bottom: entry.bottomSpacing),
          child: InFamilyRow(
            key: const ValueKey('home-feed-family'),
            refreshToken: _feedRefreshTick,
          ),
        );
      case _HomeFeedEntryKind.playables:
        return Padding(
          padding: EdgeInsets.only(bottom: entry.bottomSpacing),
          child: const PlayablesShelf(),
        );
      case _HomeFeedEntryKind.raftaarShorts:
        return Padding(
          padding: EdgeInsets.only(bottom: entry.bottomSpacing),
          child: RaftaarShortsRow(
            key: ValueKey('home-feed-${entry.key}'),
            shorts: entry.shorts,
            title: entry.title,
          ),
        );
    }
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
    if (cat == 'Verticals' ||
        cat == 'Raftaar (Vertical Videos)' ||
        cat.toLowerCase().contains('raftaar')) {
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
